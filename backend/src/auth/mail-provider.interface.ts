/**
 * 메일 제공자 추상화. 기준 정의는 `docs/01-메일연동.md`.
 *
 * 현재 구현체는 GmailProvider 하나뿐이지만(Gmail 단독 결정 — `docs/00-개요.md`),
 * 제공자 교체/추가 시 수집 파이프라인을 건드리지 않도록 인터페이스를 유지한다.
 *
 * ## 문서와 달라진 점 (2026-09-22 구현)
 *
 * 문서의 시그니처는 `fetchNewMessages(userId, cursor)`처럼 `userId`를 받는데, 실제로는
 * **토큰**이 있어야 API를 호출할 수 있다. Gmail API는 토큰의 주인을 `'me'`로 지칭하므로
 * `userId`는 쓰이지 않는다. 그래서 `userId` 대신 `ProviderTokenSet`을 받도록 바꿨다.
 * 제공자가 DB를 조회하지 않게 되어 상태 없는 구현으로 유지된다.
 *
 * 또한 `historyId` 만료(404) 시 전체 재동기화가 필요해(`docs/01` "신규 메일 조회")
 * `fetchMessagesSince()`를 추가했다.
 */

import type { MailProviderName } from '../common/types/domain';

export interface ProviderTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

export interface RawMailMessage {
  /** Gmail message id */
  providerMessageId: string;
  from: string;
  subject: string;
  receivedAt: Date;
}

export interface MailBody {
  html?: string;
  text?: string;
}

/** Gmail의 historyId를 감싼다. mail_accounts.cursor(JSONB)에 그대로 직렬화된다. */
export interface ProviderCursor {
  historyId: string;
}

export interface WatchHandle {
  historyId: string;
  expiresAt: Date;
}

export interface FetchResult {
  messages: RawMailMessage[];
  nextCursor: ProviderCursor;
}

/**
 * 커서가 너무 오래되어 제공자가 변경분을 돌려줄 수 없을 때 던진다.
 * 호출자는 `fetchMessagesSince()`로 전체 재동기화해야 한다 (`docs/01`, `docs/08`).
 */
export class HistoryExpiredError extends Error {
  constructor(cursor: string) {
    super(`히스토리 커서가 만료되었다: ${cursor}`);
    this.name = 'HistoryExpiredError';
  }
}

/** 토큰이 폐기되었거나 만료되어 재인증이 필요할 때 던진다. */
export class ReauthRequiredError extends Error {
  constructor(reason: string) {
    super(`재인증이 필요하다: ${reason}`);
    this.name = 'ReauthRequiredError';
  }
}

export interface MailProvider {
  readonly providerName: MailProviderName;

  // 인증
  getAuthUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<ProviderTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<ProviderTokenSet>;
  revokeToken(refreshToken: string): Promise<void>;

  // 수집
  registerWatch(token: ProviderTokenSet): Promise<WatchHandle>;
  fetchNewMessages(
    token: ProviderTokenSet,
    cursor: ProviderCursor,
  ): Promise<FetchResult>;
  /** 커서 만료 시 전체 재동기화용 — since 이후 도착한 메일을 모두 가져온다. */
  fetchMessagesSince(token: ProviderTokenSet, since: Date): Promise<FetchResult>;
  fetchMessageBody(
    token: ProviderTokenSet,
    messageId: string,
  ): Promise<MailBody>;
}

/** DI 토큰 */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
