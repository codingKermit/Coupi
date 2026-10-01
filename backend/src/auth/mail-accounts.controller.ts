import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, SessionGuard } from './session.guard';
import {
  MailAccountService,
  type MailAccountSummary,
} from './mail-account.service';

@Controller('mail-accounts')
@UseGuards(SessionGuard)
export class MailAccountsController {
  constructor(private readonly mailAccounts: MailAccountService) {}

  /**
   * 연결된 계정 목록 (`docs/06-모바일앱구조.md` "설정").
   *
   * `docs/03-API-DB-스펙.md`에는 이 엔드포인트가 빠져 있었다. 설정 화면이
   * "연결된 메일 계정 목록"을 요구하는데 조회 수단이 없어 추가했다.
   * 홈 화면의 재인증 배너도 이 응답의 `needsReauth`로 판단한다.
   */
  @Get()
  async list(
    @CurrentUser() userId: string,
  ): Promise<{ mailAccounts: MailAccountSummary[] }> {
    return { mailAccounts: await this.mailAccounts.list(userId) };
  }

  /** 계정 연결 해제 (`docs/07-보안개인정보.md` "토큰 폐기 흐름"). */
  @Delete(':id')
  @HttpCode(204)
  async disconnect(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const result = await this.mailAccounts.disconnect(userId, id);

    if (result === 'not_found') throw new NotFoundException();
    if (result === 'forbidden') throw new ForbiddenException();
  }
}
