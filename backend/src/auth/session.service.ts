import { randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/** 앱 세션 유효 기간. 모바일 앱은 재로그인 부담이 크므로 길게 잡는다. */
const SESSION_TTL = '30d';

/** OAuth state 토큰 유효 기간. 동의 화면 체류 시간을 감안한 값이다. */
const STATE_TTL = '10m';

interface SessionClaims {
  sub: string;
  typ: 'session';
}

interface StateClaims {
  nonce: string;
  typ: 'state';
}

/**
 * 앱 자체 세션과 OAuth state를 JWT로 다룬다 (`docs/03-API-DB-스펙.md` "공통 사항").
 *
 * state를 서버에 저장하지 않고 서명한 토큰으로 왕복시킨다. 저장소가 없어도 위조를 막을 수
 * 있고, 인스턴스가 여러 개로 늘어나도 공유 상태가 필요 없다.
 *
 * `@nestjs/jwt` 대신 `jsonwebtoken`을 직접 쓴다 — v11이 ESM 전용이라 CommonJS 빌드와
 * Jest 런타임에서 깨진다. 래퍼가 주는 이점도 여기서는 없다.
 */
@Injectable()
export class SessionService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('SESSION_JWT_SECRET');
  }

  issueSession(userId: string): string {
    const claims: SessionClaims = { sub: userId, typ: 'session' };
    return jwt.sign(claims, this.secret, { expiresIn: SESSION_TTL });
  }

  verifySession(token: string): string {
    const claims = this.verify<SessionClaims>(token);

    if (claims.typ !== 'session' || !claims.sub) {
      throw new UnauthorizedException('세션 토큰이 아니다.');
    }

    return claims.sub;
  }

  /** CSRF 방지용 state. 인증 URL 발급 시 만들고 콜백에서 검증한다. */
  issueState(): string {
    const claims: StateClaims = { nonce: randomUUID(), typ: 'state' };
    return jwt.sign(claims, this.secret, { expiresIn: STATE_TTL });
  }

  verifyState(token: string): void {
    const claims = this.verify<StateClaims>(token);

    if (claims.typ !== 'state') {
      throw new UnauthorizedException('state 토큰이 아니다.');
    }
  }

  private verify<T>(token: string): T {
    try {
      return jwt.verify(token, this.secret) as T;
    } catch {
      // 만료와 위조를 구분해 알려주지 않는다 — 공격자에게 단서가 된다.
      throw new UnauthorizedException('토큰이 유효하지 않다.');
    }
  }
}
