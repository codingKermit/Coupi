import { PubSub, type Topic } from '@google-cloud/pubsub';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Pub/Sub 발행 래퍼 (`docs/05-백엔드아키텍처.md`).
 *
 * `PUBSUB_EMULATOR_HOST`가 설정되어 있으면 클라이언트 라이브러리가 자동으로 에뮬레이터에
 * 붙으므로, 로컬 개발에서 별도 분기가 필요 없다.
 */
@Injectable()
export class PubSubPublisher {
  private readonly logger = new Logger(PubSubPublisher.name);
  private readonly client: PubSub;
  private readonly topics = new Map<string, Topic>();

  constructor(private readonly config: ConfigService) {
    this.client = new PubSub({
      projectId: config.getOrThrow<string>('GCP_PROJECT_ID'),
    });
  }

  /**
   * @param orderingKey 지정하면 같은 키의 메시지가 순서대로 전달된다.
   *   메일 수집은 `mailAccountId`를 키로 써서 계정별 순서를 보장한다 (`docs/05`).
   */
  async publish<T>(
    topicName: string,
    payload: T,
    orderingKey?: string,
  ): Promise<string> {
    const topic = this.topicFor(topicName, orderingKey !== undefined);

    const messageId = await topic.publishMessage({
      data: Buffer.from(JSON.stringify(payload), 'utf8'),
      ...(orderingKey ? { orderingKey } : {}),
    });

    this.logger.debug(`발행: ${topicName} messageId=${messageId}`);
    return messageId;
  }

  private topicFor(name: string, ordered: boolean): Topic {
    const cacheKey = `${name}:${ordered}`;
    const cached = this.topics.get(cacheKey);
    if (cached) return cached;

    const topic = this.client.topic(name, {
      messageOrdering: ordered,
      // 순서 보장 토픽은 한 키의 메시지를 직렬로 보내야 하므로 배치를 짧게 끊는다.
      batching: { maxMessages: ordered ? 1 : 100, maxMilliseconds: 50 },
    });

    this.topics.set(cacheKey, topic);
    return topic;
  }
}
