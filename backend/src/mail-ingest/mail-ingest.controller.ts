import { Body, Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';

import { MailIngestService } from './mail-ingest.service';
import { PubSubPushGuard } from './pubsub-push.guard';
import { PubSubPushDto } from './dto/pubsub-push.dto';
import { decodePubSubData } from '../common/types/messages';
import type { MailIngestMessage } from '../common/types/messages';

/**
 * `mail-ingest` 토픽의 push 구독 수신점 (`docs/05-백엔드아키텍처.md`).
 *
 * 2xx를 돌려줘야 ack된다. 예외를 던지면 Pub/Sub이 재전송하고, 5회 실패하면
 * dead letter topic으로 넘어간다 (`infra/terraform/pubsub.tf`).
 */
@Controller('internal')
@UseGuards(PubSubPushGuard)
export class MailIngestController {
  private readonly logger = new Logger(MailIngestController.name);

  constructor(private readonly mailIngest: MailIngestService) {}

  @Post('mail-ingest')
  @HttpCode(204)
  async handle(@Body() body: PubSubPushDto): Promise<void> {
    const message = decodePubSubData<MailIngestMessage>(body);

    if (!message.mailAccountId) {
      // 재전송해도 고쳐지지 않는 형식 오류이므로 ack한다.
      this.logger.warn('mailAccountId가 없는 메시지를 무시한다.');
      return;
    }

    const outcome = await this.mailIngest.handle(message);

    this.logger.log(
      `수집 완료 계정=${message.mailAccountId} 조회=${outcome.fetched} ` +
        `통과=${outcome.passedFilter} 기록=${outcome.recorded}` +
        (outcome.resynced ? ' (재동기화)' : '') +
        (outcome.skipped ? ` 건너뜀=${outcome.skipped}` : ''),
    );
  }
}
