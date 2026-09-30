import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../common/prisma/prisma.service';
import { PubSubPublisher } from '../common/messaging/pubsub.publisher';
import type { MailIngestMessage } from '../common/types/messages';

export interface SafetyPollResult {
  accounts: number;
  enqueued: number;
}

/**
 * `gmail-safety-poll` — Cloud Scheduler가 6시간마다 호출한다
 * (`docs/01-메일연동.md` "안전망: 보정 폴링").
 *
 * Pub/Sub webhook이 드물게 유실될 수 있으므로, 활성 계정 전체를 다시 수집 큐에 넣는다.
 * 실제 조회와 중복 제거는 수집 핸들러가 하던 그대로 처리한다 — 여기서 Gmail API를
 * 직접 부르지 않는 이유는, 수집 경로를 하나로 유지해야 중복 제거와 오류 처리가
 * 한 곳에만 있기 때문이다.
 *
 * 이미 처리한 메일은 `processed_mails` 유니크 제약에 걸려 다시 발행되지 않는다.
 */
@Injectable()
export class GmailSafetyPollJob {
  private readonly logger = new Logger(GmailSafetyPollJob.name);
  private readonly ingestTopic: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: PubSubPublisher,
    config: ConfigService,
  ) {
    this.ingestTopic = config.getOrThrow<string>('PUBSUB_TOPIC_MAIL_INGEST');
  }

  async run(): Promise<SafetyPollResult> {
    const accounts = await this.prisma.mailAccount.findMany({
      where: { provider: 'gmail', status: 'active' },
      select: { id: true },
    });

    let enqueued = 0;

    for (const account of accounts) {
      const payload: MailIngestMessage = {
        mailAccountId: account.id,
        triggeredBy: 'polling',
      };

      try {
        // ordering key는 webhook 경로와 동일하게 계정 id를 쓴다.
        // 같은 계정의 webhook 메시지와 순서가 엉키지 않게 하기 위해서다 (docs/05).
        await this.publisher.publish(this.ingestTopic, payload, account.id);
        enqueued += 1;
      } catch (error) {
        // 한 계정 실패가 나머지를 막지 않게 한다. 다음 6시간 주기에 다시 시도된다.
        this.logger.warn(
          `보정 폴링 적재 실패 계정=${account.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(`보정 폴링 — 계정 ${accounts.length} 적재 ${enqueued}`);

    return { accounts: accounts.length, enqueued };
  }
}
