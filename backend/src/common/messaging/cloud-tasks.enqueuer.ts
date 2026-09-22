import { CloudTasksClient } from '@google-cloud/tasks';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cloud Tasks 적재 래퍼 (`docs/05-백엔드아키텍처.md`).
 *
 * Pub/Sub과 달리 **지연 예약**(`scheduleTime`)과 큐 단위 속도 제어가 되므로,
 * 푸시 발송과 만료 리마인더에 쓴다.
 */
@Injectable()
export class CloudTasksEnqueuer {
  private readonly logger = new Logger(CloudTasksEnqueuer.name);
  private readonly client = new CloudTasksClient();

  private readonly projectId: string;
  private readonly location: string;
  private readonly workerBaseUrl: string;
  private readonly invokerEmail?: string;

  constructor(config: ConfigService) {
    this.projectId = config.getOrThrow<string>('GCP_PROJECT_ID');
    this.location = config.getOrThrow<string>('GCP_LOCATION');
    this.workerBaseUrl = config
      .getOrThrow<string>('WORKER_BASE_URL')
      .replace(/\/+$/, '');
    this.invokerEmail =
      config.get<string>('TASKS_INVOKER_SA_EMAIL') ??
      config.get<string>('PUBSUB_PUSH_SA_EMAIL');
  }

  /**
   * @param path 워커의 타깃 경로 (예: `/internal/push-dispatch`)
   * @param scheduleTime 지정하면 그 시각에 배달된다. 과거 시각은 즉시 실행된다.
   */
  async enqueue<T>(
    queueName: string,
    path: string,
    payload: T,
    scheduleTime?: Date,
  ): Promise<string | null> {
    const parent = this.client.queuePath(
      this.projectId,
      this.location,
      queueName,
    );

    const [response] = await this.client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `${this.workerBaseUrl}${path}`,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
          // 워커는 내부 전용이므로 OIDC 토큰을 붙여 호출한다 (docs/05).
          ...(this.invokerEmail
            ? { oidcToken: { serviceAccountEmail: this.invokerEmail } }
            : {}),
        },
        ...(scheduleTime
          ? {
              scheduleTime: {
                seconds: Math.floor(scheduleTime.getTime() / 1000),
              },
            }
          : {}),
      },
    });

    this.logger.debug(`적재: ${queueName} task=${response.name ?? '(이름 없음)'}`);
    return response.name ?? null;
  }
}
