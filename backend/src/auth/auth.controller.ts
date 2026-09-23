import { Body, Controller, Get, Post } from '@nestjs/common';

import { AuthService, type AuthUrlResult, type ConnectResult } from './auth.service';
import { GmailCallbackDto } from './dto/gmail-callback.dto';

/**
 * Gmail 연결 (`docs/03-API-DB-스펙.md` "인증 관련").
 *
 * **세션 가드를 붙이지 않는다.** 온보딩이 "Gmail로 시작하기" 단일 진입점이라
 * (`docs/06-모바일앱구조.md`) 이 두 엔드포인트는 세션을 받기 전에 호출된다.
 * CSRF는 `state` 토큰으로 막는다.
 */
@Controller('auth/gmail')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('url')
  getUrl(): AuthUrlResult {
    return this.auth.getAuthUrl();
  }

  @Post('callback')
  async callback(@Body() dto: GmailCallbackDto): Promise<ConnectResult> {
    return this.auth.connect(dto.code, dto.state);
  }
}
