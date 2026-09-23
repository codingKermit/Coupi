import { Body, Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';

import { CouponClassifyService } from './coupon-classify.service';
import { InternalCallerGuard } from '../common/messaging/internal-caller.guard';
import { PubSubPushDto } from '../common/messaging/dto/pubsub-push.dto';
import { decodePubSubData } from '../common/types/messages';
import type { CouponClassifyMessage } from '../common/types/messages';

/**
 * `coupon-classify` 토픽의 push 구독 수신점 (`docs/05-백엔드아키텍처.md`).
 *
 * 2xx를 돌려줘야 ack된다. 예외를 던지면 재전송되고, 5회 실패하면
 * dead letter topic으로 넘어간다 (`infra/terraform/pubsub.tf`).
 */
@Controller('internal')
@UseGuards(InternalCallerGuard)
export class CouponClassifyController {
  private readonly logger = new Logger(CouponClassifyController.name);

  constructor(private readonly classify: CouponClassifyService) {}

  @Post('coupon-classify')
  @HttpCode(204)
  async handle(@Body() body: PubSubPushDto): Promise<void> {
    const message = decodePubSubData<CouponClassifyMessage>(body);

    if (!message.processedMailId) {
      // 재전송해도 고쳐지지 않는 형식 오류이므로 ack한다.
      this.logger.warn('processedMailId가 없는 메시지를 무시한다.');
      return;
    }

    const outcome = await this.classify.handle(message);

    this.logger.log(
      `판별 완료 mail=${message.processedMailId} 결과=${outcome.verdict}` +
        (outcome.reason ? ` (${outcome.reason})` : '') +
        (outcome.couponId ? ` coupon=${outcome.couponId}` : ''),
    );
  }
}
