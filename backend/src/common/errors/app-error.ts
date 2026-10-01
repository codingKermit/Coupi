import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 프런트가 `code`로 분기할 수 있는 도메인 오류
 * (`docs/03-API-DB-스펙.md` "에러 응답 포맷 통일").
 *
 * 메시지는 사람이 읽는 용도이고, 분기는 반드시 `code`로 한다 —
 * 메시지 문구는 바뀔 수 있다.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, status);
  }
}

/**
 * 프런트가 분기하는 코드. 새로 추가할 때는 앱 쪽 처리도 함께 본다.
 * `docs/03`이 예로 든 두 개를 포함한다.
 */
export const ERROR_CODES = [
  /** Gmail refresh token이 폐기됨 — 재인증 유도 */
  'GMAIL_TOKEN_REVOKED',
  /** Gmail 인증 실패 (코드 교환·동의 거부 등) */
  'GMAIL_AUTH_FAILED',
  /** 이미 연결된 계정 */
  'MAIL_ACCOUNT_ALREADY_CONNECTED',
  /** 세션 없음·만료 */
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_REQUEST',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** HTTP 상태만 있는 일반 예외를 코드로 옮긴다. */
export function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}
