import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { Request } from 'express';

/**
 * Pub/Sub push 요청이 정말 Google에서 온 것인지 검증한다
 * (`docs/01-메일연동.md` "Webhook 수신기", `docs/05` "내부 엔드포인트 보호").
 *
 * 이 검증이 없으면 누구나 `/internal/*`에 가짜 알림을 밀어넣어 임의 계정의 메일 수집을
 * 트리거할 수 있다. 엔드포인트가 공개 URL이므로 반드시 필요하다.
 */
@Injectable()
export class PubSubPushGuard implements CanActivate {
  private readonly logger = new Logger(PubSubPushGuard.name);
  private readonly client = new OAuth2Client();

  private readonly expectedEmail?: string;
  private readonly audience?: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.expectedEmail = config.get<string>('PUBSUB_PUSH_SA_EMAIL');
    this.audience = config.get<string>('PUBSUB_PUSH_AUDIENCE');
    this.isProduction = config.get<string>('NODE_ENV') === 'production';

    if (this.isProduction && !this.expectedEmail) {
      throw new Error(
        'PUBSUB_PUSH_SA_EMAIL이 없으면 운영에서 push 요청을 검증할 수 없다.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);

    if (!token) {
      // 로컬 개발과 에뮬레이터는 OIDC 토큰을 붙이지 않는다.
      if (!this.isProduction) {
        this.logger.warn('OIDC 토큰 없이 push 요청을 허용한다 (개발 환경)');
        return true;
      }
      throw new UnauthorizedException('OIDC 토큰이 없다.');
    }

    let email: string | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        ...(this.audience ? { audience: this.audience } : {}),
      });
      email = ticket.getPayload()?.email;
    } catch (error) {
      this.logger.warn(
        `OIDC 토큰 검증 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('OIDC 토큰이 유효하지 않다.');
    }

    if (this.expectedEmail && email !== this.expectedEmail) {
      this.logger.warn(`예상과 다른 서비스 계정: ${email ?? '(없음)'}`);
      throw new UnauthorizedException('허용되지 않은 호출자다.');
    }

    return true;
  }

  private bearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;

    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
}
