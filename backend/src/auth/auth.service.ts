import { ConflictException, Injectable, Logger } from '@nestjs/common';

import { EncryptionService } from '../common/encryption/encryption.service';
import { GmailProvider } from './gmail.provider';
import { PrismaService } from '../common/prisma/prisma.service';
import { SessionService } from './session.service';

export interface AuthUrlResult {
  url: string;
  state: string;
}

export interface ConnectResult {
  mailAccountId: string;
  email: string;
  /** 앱 세션 토큰 — 이후 모든 요청의 Authorization 헤더에 쓴다 */
  accessToken: string;
}

/**
 * Gmail 연결과 앱 세션 발급 (`docs/01-메일연동.md`, `docs/03-API-DB-스펙.md`).
 *
 * 온보딩이 "Gmail로 시작하기" 단일 진입점이므로(`docs/06-모바일앱구조.md`),
 * 이 흐름이 곧 회원가입 겸 로그인이다.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailProvider,
    private readonly encryption: EncryptionService,
    private readonly sessions: SessionService,
  ) {}

  getAuthUrl(): AuthUrlResult {
    const state = this.sessions.issueState();
    return { url: this.gmail.getAuthUrl(state), state };
  }

  async connect(code: string, state: string): Promise<ConnectResult> {
    this.sessions.verifyState(state);

    const token = await this.gmail.exchangeCodeForToken(code);
    const email = await this.gmail.fetchAccountEmail(token);

    // 메일 주소를 계정 식별자로 쓴다. 별도 회원가입이 없으므로 첫 연결이 곧 가입이다.
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true },
    });

    const existing = await this.prisma.mailAccount.findUnique({
      where: {
        userId_provider_providerAccountEmail: {
          userId: user.id,
          provider: 'gmail',
          providerAccountEmail: email,
        },
      },
      select: { id: true, status: true },
    });

    // 이미 연결된 계정을 다시 연결하려는 경우 (docs/08 "데이터 정합성").
    // 다만 재인증이 필요한 상태였다면 되살리는 것이 사용자의 의도다.
    if (existing && existing.status === 'active') {
      throw new ConflictException('이미 연결된 Gmail 계정이다.');
    }

    const encrypted = {
      encryptedRefreshToken: await this.encryption.encrypt(token.refreshToken),
      encryptedAccessToken: await this.encryption.encrypt(token.accessToken),
      accessTokenExpiresAt: token.expiresAt,
    };

    const mailAccount = existing
      ? await this.prisma.mailAccount.update({
          where: { id: existing.id },
          data: { ...encrypted, status: 'active', consecutiveFailures: 0 },
          select: { id: true },
        })
      : await this.prisma.mailAccount.create({
          data: {
            userId: user.id,
            provider: 'gmail',
            providerAccountEmail: email,
            ...encrypted,
          },
          select: { id: true },
        });

    // watch를 등록해야 신규 메일 알림이 오기 시작한다 (docs/01).
    await this.registerWatch(mailAccount.id, token);

    return {
      mailAccountId: mailAccount.id,
      email,
      accessToken: this.sessions.issueSession(user.id),
    };
  }

  private async registerWatch(
    mailAccountId: string,
    token: Parameters<GmailProvider['registerWatch']>[0],
  ): Promise<void> {
    try {
      const handle = await this.gmail.registerWatch(token);
      await this.prisma.mailAccount.update({
        where: { id: mailAccountId },
        data: { cursor: { historyId: handle.historyId } },
      });
    } catch (error) {
      // watch 등록에 실패해도 연결 자체는 성공으로 둔다. 6시간 보정 폴링이
      // 메일을 가져오고, 갱신 배치가 다음 주기에 watch를 다시 시도한다 (docs/01, docs/08).
      this.logger.warn(
        `watch 등록 실패 — 보정 폴링에 의존한다: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
