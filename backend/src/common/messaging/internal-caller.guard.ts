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
 * `/internal/*` 엔드포인트를 보호한다 (`docs/01-메일연동.md` "Webhook 수신기",
 * `docs/05-백엔드아키텍처.md` "내부 엔드포인트 보호").
 *
 * Pub/Sub push 구독과 Cloud Tasks 둘 다 Google이 서명한 OIDC 토큰을 붙여 호출하므로
 * 같은 검증을 쓴다. 호출 주체가 서로 다른 서비스 계정일 수 있어 허용 목록으로 받는다.
 *
 * 이 검증이 없으면 누구나 내부 엔드포인트에 가짜 요청을 밀어넣어 임의 계정의 수집이나
 * 푸시 발송을 트리거할 수 있다. API 서비스가 공개 URL이므로 반드시 필요하다.
 */
@Injectable()
export class InternalCallerGuard implements CanActivate {
  private readonly logger = new Logger(InternalCallerGuard.name);
  private readonly client = new OAuth2Client();

  private readonly allowedEmails: Set<string>;
  private readonly audience?: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.allowedEmails = new Set(
      [
        config.get<string>('PUBSUB_PUSH_SA_EMAIL'),
        config.get<string>('TASKS_INVOKER_SA_EMAIL'),
      ].filter((email): email is string => Boolean(email)),
    );

    this.audience = config.get<string>('PUBSUB_PUSH_AUDIENCE');
    this.isProduction = config.get<string>('NODE_ENV') === 'production';

    if (this.isProduction && this.allowedEmails.size === 0) {
      throw new Error(
        'PUBSUB_PUSH_SA_EMAIL이 없으면 운영에서 내부 호출을 검증할 수 없다.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.bearerToken(request);

    if (!token) {
      // 로컬 개발과 에뮬레이터는 OIDC 토큰을 붙이지 않는다.
      if (!this.isProduction) {
        this.logger.warn('OIDC 토큰 없이 내부 호출을 허용한다 (개발 환경)');
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

    if (this.allowedEmails.size > 0 && (!email || !this.allowedEmails.has(email))) {
      this.logger.warn(`허용 목록에 없는 서비스 계정: ${email ?? '(없음)'}`);
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
