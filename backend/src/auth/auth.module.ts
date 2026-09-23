import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GmailProvider } from './gmail.provider';
import { MailAccountService } from './mail-account.service';
import { MailAccountTokenService } from './mail-account-token.service';
import { MailAccountsController } from './mail-accounts.controller';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import { MAIL_PROVIDER } from './mail-provider.interface';

@Module({

  controllers: [AuthController, MailAccountsController],
  providers: [
    GmailProvider,
    AuthService,
    MailAccountService,
    MailAccountTokenService,
    SessionService,
    SessionGuard,
    // 제공자를 인터페이스로 주입받고 싶은 곳을 위한 별칭.
    // Gmail 단독이지만 수집 파이프라인이 구현체에 직접 묶이지 않게 한다 (docs/01).
    { provide: MAIL_PROVIDER, useExisting: GmailProvider },
  ],
  exports: [
    GmailProvider,
    MailAccountTokenService,
    SessionService,
    SessionGuard,
    MAIL_PROVIDER,
  ],
})
export class AuthModule {}
