import {
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, SessionGuard } from './session.guard';
import { MailAccountService } from './mail-account.service';

@Controller('mail-accounts')
@UseGuards(SessionGuard)
export class MailAccountsController {
  constructor(private readonly mailAccounts: MailAccountService) {}

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
