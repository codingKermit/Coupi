import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';
import type { DevicePlatform } from '../common/types/domain';

export type UnregisterResult = 'ok' | 'not_found' | 'forbidden';

/**
 * 디바이스 토큰 수명주기 (`docs/04-푸시알림.md` "디바이스 토큰 수명주기").
 *
 * 무효 토큰 삭제는 발송 쪽(`NotificationService`)이 담당한다 — 실제로 죽었는지는
 * 발송해봐야 알 수 있기 때문이다.
 */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 등록 또는 갱신.
   *
   * 클라이언트가 토큰 갱신(`onTokenRefresh`)을 감지하면 같은 엔드포인트를 다시 부른다.
   * `(user_id, fcm_token)` 유니크 제약이 있어 upsert로 처리하면 중복이 생기지 않는다.
   */
  async register(
    userId: string,
    fcmToken: string,
    platform: DevicePlatform,
  ): Promise<string> {
    const device = await this.prisma.device.upsert({
      where: { userId_fcmToken: { userId, fcmToken } },
      update: { platform, lastActiveAt: new Date() },
      create: { userId, fcmToken, platform },
      select: { id: true },
    });

    return device.id;
  }

  /** 로그아웃 시 호출한다. */
  async unregister(
    userId: string,
    deviceId: string,
  ): Promise<UnregisterResult> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { userId: true },
    });

    if (!device) return 'not_found';
    if (device.userId !== userId) return 'forbidden';

    await this.prisma.device.delete({ where: { id: deviceId } });
    return 'ok';
  }
}
