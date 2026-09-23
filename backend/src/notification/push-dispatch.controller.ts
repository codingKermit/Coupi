import {
  Body,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';

import { InternalCallerGuard } from '../common/messaging/internal-caller.guard';
import { NotificationService } from './notification.service';
import type {
  ExpiryReminderTask,
  PushDispatchTask,
} from '../common/types/messages';

/**
 * Cloud Tasks 타깃 엔드포인트 (`docs/05-백엔드아키텍처.md`).
 *
 * Pub/Sub push와 달리 Cloud Tasks는 페이로드를 그대로 본문에 담아 보낸다 (봉투 없음).
 *
 * 2xx면 태스크가 완료 처리된다. 일시적 실패가 남아 있을 때만 5xx를 돌려줘 재시도를
 * 유도하고, 영구 실패(죽은 토큰 등)는 재시도해도 같으므로 2xx로 닫는다
 * (`docs/04-푸시알림.md` "재시도 및 실패 정책").
 */
@Controller('internal')
@UseGuards(InternalCallerGuard)
export class PushDispatchController {
  private readonly logger = new Logger(PushDispatchController.name);

  constructor(private readonly notifications: NotificationService) {}

  @Post('push-dispatch')
  @HttpCode(204)
  async pushDispatch(@Body() task: PushDispatchTask): Promise<void> {
    await this.run(task.couponId, task.notificationType ?? 'new_coupon');
  }

  @Post('expiry-reminder')
  @HttpCode(204)
  async expiryReminder(@Body() task: ExpiryReminderTask): Promise<void> {
    await this.run(task.couponId, 'expiry_reminder');
  }

  private async run(
    couponId: string,
    notificationType: 'new_coupon' | 'expiry_reminder',
  ): Promise<void> {
    if (!couponId) {
      // 재시도해도 고쳐지지 않는 형식 오류이므로 완료 처리한다.
      this.logger.warn('couponId가 없는 태스크를 무시한다.');
      return;
    }

    const outcome = await this.notifications.dispatch(
      couponId,
      notificationType,
    );

    this.logger.log(
      `발송 coupon=${couponId} type=${notificationType} 결과=${outcome.verdict} ` +
        `성공=${outcome.sent} 실패=${outcome.failed}` +
        (outcome.reason ? ` (${outcome.reason})` : ''),
    );

    if (outcome.shouldRetry) {
      throw new InternalServerErrorException(
        '일시적 발송 실패 — Cloud Tasks 재시도 대상',
      );
    }
  }
}
