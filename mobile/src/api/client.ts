/**
 * 백엔드 호출 공통 처리.
 *
 * 기기에서 실행할 때는 `localhost`가 기기 자신을 가리키므로 쓸 수 없다.
 * `.env`의 `EXPO_PUBLIC_API_BASE_URL`에 개발 PC의 LAN 주소를 넣는다.
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
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

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  // 204 No Content는 본문이 없다.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/**
 * 서버는 `{ error: { code, message } }` 형태를 쓰기로 했지만
 * (`docs/03-API-DB-스펙.md` "공통 사항"), Nest 기본 예외는 `{ message }`로 나간다.
 * 둘 다 받아들인다 — 형식 통일은 서버 쪽 과제다.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      message?: string | string[];
    };

    const message = data.error?.message ?? data.message;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return message;
  } catch {
    // 본문이 JSON이 아닐 수 있다 (프록시 오류 페이지 등).
  }

  return `요청 실패 (HTTP ${response.status})`;
}
