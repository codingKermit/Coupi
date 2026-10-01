import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { AppError, codeForStatus, type ErrorCode } from './app-error';

export interface ErrorResponseBody {
  error: { code: ErrorCode; message: string };
}

/**
 * 모든 오류를 `{ error: { code, message } }`로 통일한다
 * (`docs/03-API-DB-스펙.md` "공통 사항").
 *
 * Nest 기본 응답은 `{ statusCode, message, error }`라 앱이 두 형태를 모두
 * 다뤄야 했다. 여기서 한 형태로 모은다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.statusOf(exception);

    // 5xx만 기록한다. 4xx는 정상적인 거절이라 로그를 더럽힌다.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
    }

    response.status(status).json({
      error: { code: this.codeOf(exception, status), message: this.messageOf(exception, status) },
    } satisfies ErrorResponseBody);
  }

  private statusOf(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private codeOf(exception: unknown, status: number): ErrorCode {
    if (exception instanceof AppError) return exception.code;
    return codeForStatus(status);
  }

  private messageOf(exception: unknown, status: number): string {
    // 서버 내부 오류의 메시지는 밖으로 내보내지 않는다 — 구현 세부가 샌다.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return '요청을 처리하지 못했습니다.';
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') return body;

      // ValidationPipe는 message를 배열로 준다.
      const message = (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join(', ');
      if (message) return message;
    }

    return '요청을 처리하지 못했습니다.';
  }
}
