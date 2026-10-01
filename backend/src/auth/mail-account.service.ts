import { Injectable, Logger } from '@nestjs/common';

import { EncryptionService } from '../common/encryption/encryption.service';
import { GmailProvider } from './gmail.provider';
import { PrismaService } from '../common/prisma/prisma.service';
import type { MailAccountStatus } from '../common/types/domain';

export type DisconnectResult = 'ok' | 'not_found' | 'forbidden';

/** 설정 화면이 쓰는 연결 계정 표현 (docs/06-모바일앱구조.md "설정"). */
export interface MailAccountSummary {
  id: string;
  email: string;
  status: MailAccountStatus;
  /** 재인증이 필요한 상태인지 — 홈 배너 노출 판단에 쓴다 (docs/06-모바일앱구조.md) */
  needsReauth: boolean;
  connectedAt: string;
}

/**
 * 계정 연결 해제 (`docs/07-보안개인정보.md` "토큰 폐기 흐름").
 *
 * 문서가 정한 순서를 그대로 따른다:
 *   1. status를 revoked로 (수집 즉시 중단)
 *   2. 큐에 남은 작업은 취소하지 않는다 — 각 핸들러가 status를 재확인해 건너뛴다
 *   3. Gmail revoke 호출
 *   4. 암호화된 토큰 컬럼을 NULL로 덮어쓴다 (논리 삭제가 아니라 실제 제거)
 *   5. 레코드 자체는 감사 목적으로 30일 보관 — 정리 배치는 별도 작업
 */
@Injectable()
export class MailAccountService {
  private readonly logger = new Logger(MailAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailProvider,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * 연결된 계정 목록. 토큰 컬럼은 내보내지 않는다 — 암호문이라도 밖으로 나갈 이유가 없다.
   */
  async list(userId: string): Promise<MailAccountSummary[]> {
    const rows = await this.prisma.mailAccount.findMany({
      // 연결 해제된(revoked) 계정은 감사 목적으로 30일 남지만 사용자에게는 보이지 않는다
      // (docs/07-보안개인정보.md 토큰 폐기 흐름 5단계).
      where: { userId, status: { not: 'revoked' } },
      select: {
        id: true,
        providerAccountEmail: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => {
      const status = (row.status ?? 'active') as MailAccountStatus;
      return {
        id: row.id,
        email: row.providerAccountEmail,
        status,
        needsReauth: status === 'reauth_required' || status === 'auth_failed',
        connectedAt: row.createdAt.toISOString(),
      };
    });
  }

  async disconnect(
    userId: string,
    mailAccountId: string,
  ): Promise<DisconnectResult> {
    const account = await this.prisma.mailAccount.findUnique({
      where: { id: mailAccountId },
      select: { id: true, userId: true, encryptedRefreshToken: true },
    });

    if (!account) return 'not_found';
    if (account.userId !== userId) return 'forbidden';

    // 1. 먼저 멈춘다. revoke가 실패하더라도 수집은 더 이상 돌지 않아야 한다.
    await this.prisma.mailAccount.update({
      where: { id: mailAccountId },
      data: { status: 'revoked' },
    });

    // 3. Google 쪽 권한을 회수한다. 이미 폐기됐어도 provider가 삼킨다.
    if (account.encryptedRefreshToken) {
      const refreshToken = await this.encryption.decrypt(
        account.encryptedRefreshToken,
      );
      await this.gmail.revokeToken(refreshToken);
    }

    // 4. 저장된 토큰을 실제로 지운다.
    await this.prisma.mailAccount.update({
      where: { id: mailAccountId },
      data: { encryptedRefreshToken: null, encryptedAccessToken: null },
    });

    this.logger.log(`계정 연결 해제 완료: ${mailAccountId}`);
    return 'ok';
  }
}
