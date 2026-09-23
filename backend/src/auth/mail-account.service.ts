import { Injectable, Logger } from '@nestjs/common';

import { EncryptionService } from '../common/encryption/encryption.service';
import { GmailProvider } from './gmail.provider';
import { PrismaService } from '../common/prisma/prisma.service';

export type DisconnectResult = 'ok' | 'not_found' | 'forbidden';

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
