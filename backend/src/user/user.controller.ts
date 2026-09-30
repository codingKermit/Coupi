import { Body, Controller, Patch, UseGuards } from '@nestjs/common';

import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { NotificationSettingsDto } from './dto/notification-settings.dto';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('users/me')
@UseGuards(SessionGuard)
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 알림 on/off (`docs/03-API-DB-스펙.md`).
   *
   * 끄면 발송 단계에서 `skipped_disabled`로 기록만 하고 넘어간다
   * (`docs/04-푸시알림.md` "발송 흐름").
   */
  @Patch('notification-settings')
  async updateNotificationSettings(
    @CurrentUser() userId: string,
    @Body() dto: NotificationSettingsDto,
  ): Promise<{ notificationsEnabled: boolean }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { notificationsEnabled: dto.notificationsEnabled },
      select: { notificationsEnabled: true },
    });

    return { notificationsEnabled: user.notificationsEnabled ?? true };
  }
}
