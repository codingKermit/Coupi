/**
 * 메일 제공자 추상화. 기준 정의는 `docs/01-메일연동.md`.
 *
 * 현재 구현체는 GmailProvider 하나뿐이지만(Gmail 단독 결정 — `docs/00-개요.md`),
 * 제공자 교체/추가 시 수집 파이프라인을 건드리지 않도록 인터페이스를 유지한다.
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

export interface MailProvider {
  readonly providerName: MailProviderName;

  // 인증
  getAuthUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<ProviderTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<ProviderTokenSet>;
  revokeToken(refreshToken: string): Promise<void>;

  // 수집
  registerWatch(userId: string, token: ProviderTokenSet): Promise<WatchHandle>;
  fetchNewMessages(
    userId: string,
    cursor: ProviderCursor,
  ): Promise<{ messages: RawMailMessage[]; nextCursor: ProviderCursor }>;
  fetchMessageBody(userId: string, messageId: string): Promise<MailBody>;
}

/** DI 토큰 */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
