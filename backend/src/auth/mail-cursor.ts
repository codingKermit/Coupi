/**
 * `mail_accounts.cursor`(JSONB)에 담기는 제공자 동기화 상태.
 *
 * 원래 `docs/03-API-DB-스펙.md`는 `{ historyId }`만 적었는데, watch 갱신 배치가
 * "만료 3일 이내 계정만 재구독"하려면 만료 시각을 알아야 한다(`docs/01-메일연동.md`).
 * 별도 컬럼을 추가하는 대신 같은 JSONB에 넣는다 — 둘 다 제공자 동기화 상태이고,
 * 스키마 마이그레이션 없이 확장할 수 있는 것이 JSONB를 쓴 이유이기 때문이다.
 */
export interface MailCursor {
  /** Gmail history 커서 */
  historyId?: string;
  /** users.watch() 구독 만료 시각 (ISO 8601) */
  watchExpiresAt?: string;
}

export function parseCursor(value: unknown): MailCursor {
  if (typeof value !== 'object' || value === null) return {};

  const raw = value as Record<string, unknown>;

  return {
    historyId:
      typeof raw.historyId === 'string' ? raw.historyId : undefined,
    watchExpiresAt:
      typeof raw.watchExpiresAt === 'string' ? raw.watchExpiresAt : undefined,
  };
}
