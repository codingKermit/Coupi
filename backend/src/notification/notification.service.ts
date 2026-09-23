import { Injectable, Logger } from '@nestjs/common';

import { FcmClient } from './fcm.client';
import { PrismaService } from '../common/prisma/prisma.service';
import { buildNotification } from './notification-message.util';
import type { NotificationType } from '../common/types/domain';

export interface DispatchOutcome {
  verdict: 'sent' | 'skipped' | 'no_devices';
  reason?: string;
  sent: number;
  failed: number;
  /** 일시적 실패가 남아 있으면 true — 호출자가 Cloud Tasks 재시도를 유도한다. */
  shouldRetry: boolean;
}

/**
 * 푸시 발송 (`docs/04-푸시알림.md` "발송 흐름").
 *
 * 사용자의 활성 디바이스 전체에 보낸다 (`docs/00-개요.md` 결정 #2).
 *
 * Cloud Tasks는 at-least-once이므로 멱등해야 한다. 이미 `sent`로 기록된 디바이스는
 * 다시 보내지 않으므로, 일부만 실패해 재시도되어도 중복 수신이 생기지 않는다.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmClient,
  ) {}

  async dispatch(
    couponId: string,
    notificationType: NotificationType,
    now: Date = new Date(),
  ): Promise<DispatchOutcome> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        processedMail: { select: { sender: true } },
        user: { select: { id: true, notificationsEnabled: true } },
      },
    });

    if (!coupon) {
      // 계정 연결 해제로 CASCADE 삭제된 경우. 재시도해도 같으므로 ack한다.
      return this.skip('쿠폰 없음');
    }

    // 리마인더가 뜰 즈음 사용자가 이미 사용 처리했거나 만료됐을 수 있다.
    if (coupon.status !== 'active') {
      return this.skip(`쿠폰 상태 ${coupon.status ?? '(없음)'}`);
    }

    if (coupon.user.notificationsEnabled === false) {
      await this.prisma.notification.create({
        data: { couponId, notificationType, sendStatus: 'skipped_disabled' },
      });
      return this.skip('알림 끔');
    }

    const devices = await this.prisma.device.findMany({
      where: { userId: coupon.user.id },
      select: { id: true, fcmToken: true },
    });

    if (devices.length === 0) {
      return { verdict: 'no_devices', sent: 0, failed: 0, shouldRetry: false };
    }

    const alreadySent = await this.sentDeviceIds(couponId, notificationType);

    const content = buildNotification(
      {
        sender: coupon.processedMail.sender,
        discount: coupon.discount,
        expiryDate: coupon.expiryDate
          ? coupon.expiryDate.toISOString().slice(0, 10)
          : null,
        notificationType,
      },
      now,
    );

    let sent = 0;
    let failed = 0;
    let shouldRetry = false;

    for (const device of devices) {
      if (alreadySent.has(device.id)) continue;

      const notification = await this.prisma.notification.create({
        data: {
          couponId,
          deviceId: device.id,
          notificationType,
          sendStatus: 'pending',
        },
        select: { id: true },
      });

      const result = await this.fcm.send({
        fcmToken: device.fcmToken,
        content,
        couponId,
        notificationType,
      });

      if (result.ok) {
        sent += 1;
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { sendStatus: 'sent', sentAt: new Date() },
        });
        continue;
      }

      failed += 1;

      // 토큰이 죽었으면 즉시 삭제한다 (docs/04 "디바이스 토큰 수명주기").
      if (result.unregistered) {
        await this.prisma.device.delete({ where: { id: device.id } });
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          sendStatus: 'failed',
          retryCount: { increment: 1 },
        },
      });

      // 일부 디바이스만 일시적으로 실패해도 재시도한다. 성공한 디바이스는
      // 위 alreadySent 검사에 걸려 다시 받지 않는다.
      if (!result.permanent) shouldRetry = true;
    }

    return { verdict: 'sent', sent, failed, shouldRetry };
  }

  /** 이미 발송에 성공한 디바이스 — 재시도 시 중복 발송을 막는다. */
  private async sentDeviceIds(
    couponId: string,
    notificationType: NotificationType,
  ): Promise<Set<string>> {
    const rows = await this.prisma.notification.findMany({
      where: { couponId, notificationType, sendStatus: 'sent' },
      select: { deviceId: true },
    });

    return new Set(
      rows
        .map((row) => row.deviceId)
        .filter((id): id is string => id !== null),
    );
  }

  private skip(reason: string): DispatchOutcome {
    this.logger.debug(`발송 건너뜀: ${reason}`);
    return { verdict: 'skipped', reason, sent: 0, failed: 0, shouldRetry: false };
  }
}
