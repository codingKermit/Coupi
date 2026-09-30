import { Injectable, Logger } from '@nestjs/common';

import { GmailProvider } from '../auth/gmail.provider';
import { MailAccountTokenService } from '../auth/mail-account-token.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReauthRequiredError } from '../auth/mail-provider.interface';
import { parseCursor } from '../auth/mail-cursor';

/**
 * 만료가 이 일수 이내로 남은 watch만 재구독한다 (`docs/01-메일연동.md`).
 * Gmail watch는 7일 후 만료되므로 하루 한 번 도는 배치에 3일 여유면 충분하다.
 */
export const RENEW_WITHIN_DAYS = 3;

/** 재시도해도 실패가 이어지면 이 횟수에서 재인증 필요로 돌린다. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export interface WatchRenewalResult {
  checked: number;
  renewed: number;
  failed: number;
  reauthRequired: number;
}

/**
 * `gmail-watch-renewal` — Cloud Scheduler가 매일 00:00 UTC에 호출한다
 * (`docs/01-메일연동.md` "Pub/Sub Watch 갱신 배치", `docs/05-백엔드아키텍처.md`).
 *
 * 실패해도 서비스가 멈추지는 않는다. watch가 끊긴 계정은 6시간 보정 폴링이 메일을
 * 가져오므로, 이 배치는 실시간성을 되돌리는 역할이다 (`docs/08`).
 */
@Injectable()
export class GmailWatchRenewalJob {
  private readonly logger = new Logger(GmailWatchRenewalJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: MailAccountTokenService,
    private readonly gmail: GmailProvider,
  ) {}

  async run(now: Date = new Date()): Promise<WatchRenewalResult> {
    const accounts = await this.prisma.mailAccount.findMany({
      where: { provider: 'gmail', status: 'active' },
      select: { id: true, cursor: true, consecutiveFailures: true },
    });

    const deadline = now.getTime() + RENEW_WITHIN_DAYS * 86_400_000;
    const result: WatchRenewalResult = {
      checked: 0,
      renewed: 0,
      failed: 0,
      reauthRequired: 0,
    };

    for (const account of accounts) {
      const { watchExpiresAt } = parseCursor(account.cursor);

      // 만료 시각을 모르는 계정(최초 등록 실패 등)은 바로 재구독 대상으로 본다.
      if (watchExpiresAt && new Date(watchExpiresAt).getTime() > deadline) {
        continue;
      }

      result.checked += 1;

      const outcome = await this.renew(
        account.id,
        account.consecutiveFailures ?? 0,
      );
      result[outcome] += 1;
    }

    this.logger.log(
      `watch 갱신 — 대상 ${result.checked} 성공 ${result.renewed} ` +
        `실패 ${result.failed} 재인증필요 ${result.reauthRequired}`,
    );

    return result;
  }

  private async renew(
    mailAccountId: string,
    consecutiveFailures: number,
  ): Promise<'renewed' | 'failed' | 'reauthRequired'> {
    const account = await this.tokens.loadActive(mailAccountId);

    // loadActive가 토큰 갱신에 실패하면 이미 reauth_required로 바꿔둔다.
    if (!account) return 'reauthRequired';

    try {
      const handle = await this.gmail.registerWatch(account.token);
      await this.tokens.saveWatch(
        mailAccountId,
        handle.historyId,
        handle.expiresAt,
      );
      return 'renewed';
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        await this.tokens.markReauthRequired(mailAccountId, error.message);
        return 'reauthRequired';
      }

      const failures = consecutiveFailures + 1;

      // 일시적 오류일 수 있으니 바로 포기하지 않는다. 계속 실패하면 사람이 봐야 한다
      // (docs/08 "Gmail Pub/Sub watch 갱신 실패").
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        await this.tokens.markReauthRequired(
          mailAccountId,
          `watch 갱신 ${failures}회 연속 실패`,
        );
        return 'reauthRequired';
      }

      await this.prisma.mailAccount.update({
        where: { id: mailAccountId },
        data: { consecutiveFailures: failures },
      });

      this.logger.warn(
        `watch 갱신 실패(${failures}/${MAX_CONSECUTIVE_FAILURES}) 계정=${mailAccountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return 'failed';
    }
  }
}
