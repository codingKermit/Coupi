/**
 * 만료 임박 리마인더 예약 시각 계산 (`docs/02-쿠폰판별로직.md` "만료 임박 리마인더").
 *
 * 문서는 "만료 1일 전, 매일 09:00 KST 배치"로 적었다. Cloud Tasks의 지연 예약을 쓰면
 * 쿠폰 생성 시점에 그 시각을 직접 잡을 수 있어 전체 스캔 배치가 필요 없다 (`docs/05`).
 */

/** KST는 DST가 없어 UTC+9 고정이다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 리마인더 발송 시각 (KST 09:00). */
export const REMINDER_HOUR_KST = 9;

/**
 * 예약할 시각을 돌려준다. 예약할 필요가 없으면 null.
 *
 * @param expiryDate ISO 날짜(YYYY-MM-DD). null이면 예약하지 않는다.
 * @param now 기준 시각
 */
export function expiryReminderTime(
  expiryDate: string | null,
  now: Date,
): Date | null {
  if (!expiryDate) return null;

  const [year, month, day] = expiryDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  // 만료일 전날 09:00 KST를 UTC 기준으로 계산한다.
  const at = new Date(
    Date.UTC(year, month - 1, day - 1, REMINDER_HOUR_KST) - KST_OFFSET_MS,
  );

  // 이미 지난 시각이면 예약하지 않는다. 방금 "새 쿠폰" 알림을 보냈는데
  // 곧바로 리마인더까지 보내면 알림 피로도만 높인다 (docs/04).
  return at.getTime() > now.getTime() ? at : null;
}
