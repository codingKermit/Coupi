import { Body, Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../common/prisma/prisma.service';
import { PubSubPublisher } from '../common/messaging/pubsub.publisher';
import { InternalCallerGuard } from '../common/messaging/internal-caller.guard';
import { PubSubPushDto, type GmailNotification } from '../common/messaging/dto/pubsub-push.dto';
import { decodePubSubData } from '../common/types/messages';
import type { MailIngestMessage } from '../common/types/messages';

/**
 * Gmail watch 알림 수신기 (`docs/01-메일연동.md` "Webhook 수신기").
 *
 * 수신 즉시 `mail-ingest` 토픽에 넣고 200을 돌려준다. Pub/Sub은 응답이 늦으면 재전송하므로
 * 실제 처리는 워커 쪽 핸들러로 분리한다.
 */
@Controller('internal/gmail')
@UseGuards(InternalCallerGuard)
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);
  private readonly ingestTopic: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: PubSubPublisher,
    config: ConfigService,
  ) {
    this.ingestTopic = config.getOrThrow<string>('PUBSUB_TOPIC_MAIL_INGEST');
  }

  @Post('webhook')
  @HttpCode(204)
  async receive(@Body() body: PubSubPushDto): Promise<void> {
    const notification = decodePubSubData<GmailNotification>(body);
    const email = notification.emailAddress;

    if (!email) {
      // 형식이 잘못된 메시지를 재전송받아도 의미가 없으므로 ack한다.
      this.logger.warn('emailAddress가 없는 Gmail 알림을 무시한다.');
      return;
    }

    const account = await this.prisma.mailAccount.findFirst({
      where: {
        provider: 'gmail',
        providerAccountEmail: email,
        status: 'active',
      },
      select: { id: true },
    });

    if (!account) {
      // 연결 해제 직후 남아 있던 알림. 재전송받아도 결과가 같으므로 ack한다.
      this.logger.debug('활성 계정을 찾지 못한 Gmail 알림을 무시한다.');
      return;
    }

    const payload: MailIngestMessage = {
      mailAccountId: account.id,
      triggeredBy: 'webhook',
      historyId: String(notification.historyId),
    };

    // ordering key로 계정 id를 써서 같은 계정의 알림이 순서대로 처리되게 한다 (docs/05).
    await this.publisher.publish(this.ingestTopic, payload, account.id);
  }
}
