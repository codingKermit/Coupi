/**
 * 백엔드 호출 공통 처리.
 *
 * 기기에서 실행할 때는 `localhost`가 기기 자신을 가리키므로 쓸 수 없다.
 * `.env`의 `EXPO_PUBLIC_API_BASE_URL`에 개발 PC의 LAN 주소를 넣는다.
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/** 서버가 내려주는 오류 코드 (`docs/03-API-DB-스펙.md` "에러 응답 포맷 통일"). */
export type ErrorCode =
  | 'GMAIL_TOKEN_REVOKED'
  | 'GMAIL_AUTH_FAILED'
  | 'MAIL_ACCOUNT_ALREADY_CONNECTED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** 분기는 메시지가 아니라 이 값으로 한다 — 문구는 바뀔 수 있다. */
    readonly code: ErrorCode | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 세션이 만료됐거나 유효하지 않다 — 재로그인이 필요하다. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 세션 토큰. 인증이 필요 없는 호출(OAuth URL 발급)에서는 생략한다. */
  token?: string | null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) throw await toApiError(response);

  // 204 No Content는 본문이 없다.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/**
 * 서버는 모든 오류를 `{ error: { code, message } }` 한 형태로 내보낸다
 * (`docs/03-API-DB-스펙.md` "공통 사항"). 다만 프록시 오류 페이지처럼 그 형식을
 * 따르지 않는 응답도 있을 수 있어 파싱 실패에 대비한다.
 */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as {
      error?: { code?: ErrorCode; message?: string };
    };

    if (data.error?.message) {
      return new ApiError(
        response.status,
        data.error.message,
        data.error.code ?? null,
      );
    }
  } catch {
    // 본문이 JSON이 아니다.
  }

  return new ApiError(response.status, `요청 실패 (HTTP ${response.status})`);
}
