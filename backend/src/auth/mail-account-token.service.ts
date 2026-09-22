import { Injectable, Logger } from '@nestjs/common';

import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GmailProvider } from './gmail.provider';
import {
  ReauthRequiredError,
  type ProviderTokenSet,
} from './mail-provider.interface';

/** access token이 이 시간 안에 만료되면 미리 갱신한다. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface MailAccountWithToken {
  id: string;
  userId: string;
  providerAccountEmail: string;
  cursor: { historyId?: string };
  token: ProviderTokenSet;
}

/**
 * 저장된 Gmail 토큰을 꺼내 쓸 수 있는 형태로 만든다.
 *
 * 복호화, 만료 임박 시 갱신, 갱신 결과 재암호화 저장까지 한 곳에서 처리한다.
 * 저장 시 새 DEK로 다시 암호화되므로 `docs/07`의 지연 재암호화가 자연스럽게 일어난다.
 */
@Injectable()
export class MailAccountTokenService {
  private readonly logger = new Logger(MailAccountTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly gmail: GmailProvider,
  ) {}

  /**
   * 계정을 불러와 바로 API 호출에 쓸 수 있는 토큰을 돌려준다.
   *
   * 계정이 active가 아니면 null. 핸들러는 처리 시작 전 이 확인을 거쳐야 한다
   * (`docs/08-에러처리및엣지케이스.md` "데이터 정합성", `docs/07` 토큰 폐기 흐름).
   */
  async loadActive(mailAccountId: string): Promise<MailAccountWithToken | null> {
    const account = await this.prisma.mailAccount.findUnique({
      where: { id: mailAccountId },
    });

    if (!account || account.status !== 'active') {
      this.logger.debug(
        `건너뜀: 계정 ${mailAccountId} 상태=${account?.status ?? '없음'}`,
      );
      return null;
    }

    if (!account.encryptedRefreshToken) {
      await this.markReauthRequired(mailAccountId, 'refresh token 없음');
      return null;
    }

    const refreshToken = await this.encryption.decrypt(
      account.encryptedRefreshToken,
    );

    const needsRefresh =
      !account.encryptedAccessToken ||
      !account.accessTokenExpiresAt ||
      account.accessTokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

    const token = needsRefresh
      ? await this.refreshAndStore(mailAccountId, refreshToken)
      : {
          accessToken: await this.encryption.decrypt(
            account.encryptedAccessToken as string,
          ),
          refreshToken,
          expiresAt: account.accessTokenExpiresAt as Date,
          scope: [],
        };

    if (!token) return null;

    return {
      id: account.id,
      userId: account.userId,
      providerAccountEmail: account.providerAccountEmail,
      cursor: (account.cursor as { historyId?: string } | null) ?? {},
      token,
    };
  }

  /** 계정을 재인증 필요 상태로 바꾼다. 수집은 여기서 멈춘다 (`docs/08`). */
  async markReauthRequired(
    mailAccountId: string,
    reason: string,
  ): Promise<void> {
    this.logger.warn(`재인증 필요: 계정 ${mailAccountId} (${reason})`);

    await this.prisma.mailAccount.update({
      where: { id: mailAccountId },
      data: { status: 'reauth_required' },
    });
  }

  /** 수집 성공 후 커서를 저장한다. */
  async saveCursor(mailAccountId: string, historyId: string): Promise<void> {
    await this.prisma.mailAccount.update({
      where: { id: mailAccountId },
      data: { cursor: { historyId }, consecutiveFailures: 0 },
    });
  }

  private async refreshAndStore(
    mailAccountId: string,
    refreshToken: string,
  ): Promise<ProviderTokenSet | null> {
    try {
      const refreshed = await this.gmail.refreshAccessToken(refreshToken);

      await this.prisma.mailAccount.update({
        where: { id: mailAccountId },
        data: {
          encryptedAccessToken: await this.encryption.encrypt(
            refreshed.accessToken,
          ),
          // 갱신 때마다 현재 DEK로 다시 암호화한다 (지연 재암호화 — docs/07)
          encryptedRefreshToken: await this.encryption.encrypt(
            refreshed.refreshToken,
          ),
          accessTokenExpiresAt: refreshed.expiresAt,
        },
      });

      return refreshed;
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        await this.markReauthRequired(mailAccountId, error.message);
        return null;
      }
      throw error;
    }
  }
}
