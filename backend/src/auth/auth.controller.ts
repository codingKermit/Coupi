import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';

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
  constructor(private readonly auth: AuthService) {}

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
   * 앱이 결과를 어떻게 받을지(딥링크 리디렉션 vs 웹뷰에서 응답 가로채기)는
   * 2단계에서 정한다. 그때까지는 JSON을 그대로 돌려준다.
   */
  @Get('callback')
  async callbackRedirect(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<ConnectResult> {
    // 사용자가 동의를 거부하면 code 대신 error가 온다.
    if (error) throw new BadRequestException(`Google 인증 거부: ${error}`);
    if (!code || !state) throw new BadRequestException('code와 state가 필요하다.');

    return this.auth.connect(code, state);
  }

  /** 앱이 코드를 직접 전달하는 경로 (`docs/03-API-DB-스펙.md`). */
  @Post('callback')
  async callback(@Body() dto: GmailCallbackDto): Promise<ConnectResult> {
    return this.auth.connect(dto.code, dto.state);
  }
}
