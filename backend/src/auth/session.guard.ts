import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from './session.service';

/** 세션이 검증된 요청에 붙는 사용자 id. */
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * 앱 세션 JWT를 검증한다 (`docs/03-API-DB-스펙.md` "공통 사항").
 *
 * OAuth 엔드포인트 두 개(`/auth/gmail/url`, `/auth/gmail/callback`)는 세션을 받기 전에
 * 호출되므로 이 가드를 붙이지 않는다.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('세션 토큰이 없다.');
    }

    request.userId = this.sessions.verifySession(
      header.slice('Bearer '.length).trim(),
    );

    return true;
  }
}

/** 컨트롤러에서 현재 사용자 id를 받는다. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.userId) {
      throw new UnauthorizedException('세션이 확인되지 않았다.');
    }

    return request.userId;
  },
);
