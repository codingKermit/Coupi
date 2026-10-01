import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import {
  AuthService,
  type AuthUrlResult,
  type ConnectResult,
} from './auth.service';
import { GmailCallbackDto } from './dto/gmail-callback.dto';

/**
 * Gmail 연결 (`docs/03-API-DB-스펙.md` "인증 관련").
 *
 * **세션 가드를 붙이지 않는다.** 온보딩이 "Gmail로 시작하기" 단일 진입점이라
 * (`docs/06-모바일앱구조.md`) 이 엔드포인트들은 세션을 받기 전에 호출된다.
 * CSRF는 `state` 토큰으로 막는다.
 */
@Controller('auth/gmail')
export class AuthController {
  private readonly successRedirect?: string;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.successRedirect = config.get<string>('OAUTH_SUCCESS_REDIRECT');
  }

  @Get('url')
  getUrl(): AuthUrlResult {
    return this.auth.getAuthUrl();
  }

  /**
   * Google이 동의 화면 뒤에 리디렉션하는 지점. **GET이다.**
   *
   * `docs/03`은 콜백을 POST로 적었는데, 그건 앱이 리디렉션을 가로채 코드를 백엔드로
   * 전달하는 흐름을 전제한 것이다. 등록한 리디렉션 URI가 백엔드를 직접 가리키는 한
   * Google은 GET으로 들어오므로 두 경로를 모두 받는다.
   *
   * `OAUTH_SUCCESS_REDIRECT`가 설정되어 있으면 앱 딥링크로 302를 보낸다.
   * 비어 있으면 JSON을 돌려준다 — 브라우저에서 직접 확인할 때 쓴다.
   */
  @Get('callback')
  async callbackRedirect(
    @Res({ passthrough: true }) res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<ConnectResult | undefined> {
    // 사용자가 동의를 거부하면 code 대신 error가 온다.
    if (error) throw new BadRequestException(`Google 인증 거부: ${error}`);
    if (!code || !state)
      throw new BadRequestException('code와 state가 필요하다.');

    const result = await this.auth.connect(code, state);

    if (!this.successRedirect) return result;

    // 세션 토큰이 URL에 실린다. 앱 딥링크로만 가고 즉시 소비되지만, OS 로그에
    // 남을 여지가 있어 베타 전에 일회성 코드 교환으로 바꾸는 것을 과제로 둔다.
    const target = new URL(this.successRedirect);
    target.searchParams.set('token', result.accessToken);
    target.searchParams.set('email', result.email);

    res.redirect(302, target.toString());
    return undefined;
  }

  /** 앱이 코드를 직접 전달하는 경로 (`docs/03-API-DB-스펙.md`). */
  @Post('callback')
  async callback(@Body() dto: GmailCallbackDto): Promise<ConnectResult> {
    return this.auth.connect(dto.code, dto.state);
  }
}
