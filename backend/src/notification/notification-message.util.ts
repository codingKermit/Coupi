import type { NotificationType } from '../common/types/domain';
import { toKstDateString } from '../coupon-classifier/validity-checker.service';

/**
 * 푸시 문구 생성 (`docs/04-푸시알림.md` "알림 페이로드 최종안").
 *
 * 페이로드에는 쿠폰 상세를 싣지 않는다. 앱이 `couponId`로 `/coupons/:id`를 조회하는 방식이라
 * FCM 4KB 제한과 정보 노출 범위를 함께 줄인다.
 */

export interface NotificationContent {
  title: string;
  body: string;
}

export interface NotificationInput {
  /** 메일 From 헤더 원문 */
  sender: string;
  discount: string | null;
  /** ISO 날짜(YYYY-MM-DD) */
  expiryDate: string | null;
  notificationType: NotificationType;
}

/**
 * From 헤더에서 사람이 읽을 이름을 뽑는다.
 * `쿠팡 <no-reply@coupang.com>` → `쿠팡`, 표시 이름이 없으면 도메인 첫 라벨을 쓴다.
 */
export function senderDisplayName(sender: string): string {
  const angle = sender.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  const display = angle?.[1]?.trim();
  if (display) return display;

  const at = sender.lastIndexOf('@');
  if (at === -1) return sender.trim();

  const domain = sender.slice(at + 1).replace(/[>\s]/g, '');
  const label = domain.split('.')[0];
  return label || domain;
}

/** 만료일까지 남은 일수 (KST 기준). 만료일이 없으면 null. */
export function daysUntilExpiry(
  expiryDate: string | null,
  now: Date,
): number | null {
  if (!expiryDate) return null;

  const [y, m, d] = expiryDate.split('-').map(Number);
  if (!y || !m || !d) return null;

  const [ty, tm, td] = toKstDateString(now).split('-').map(Number);

  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
}

/** `2026-09-30` → `9/30` */
function shortDate(expiryDate: string): string {
  const [, m, d] = expiryDate.split('-').map(Number);
  return `${m}/${d}`;
}

/** `쿠팡 15% 할인 쿠폰` — 할인 정보가 없으면 `쿠팡 쿠폰` */
function couponLabel(sender: string, discount: string | null): string {
  const name = senderDisplayName(sender);
  return discount ? `${name} ${discount} 할인 쿠폰` : `${name} 쿠폰`;
}

export function buildNotification(
  input: NotificationInput,
  now: Date = new Date(),
): NotificationContent {
  const label = couponLabel(input.sender, input.discount);

  if (input.notificationType === 'expiry_reminder') {
    return {
      title: '쿠폰 만료 임박',
      body: `${label} · ${expiryPhrase(input.expiryDate, now)}`,
    };
  }

  const until = input.expiryDate
    ? `${shortDate(input.expiryDate)}까지 사용가능`
    : '사용 가능';

  return { title: '새 쿠폰 도착', body: `${label} · ${until}` };
}

function expiryPhrase(expiryDate: string | null, now: Date): string {
  const days = daysUntilExpiry(expiryDate, now);

  if (days === null) return '곧 만료';
  if (days <= 0) return '오늘 자정 만료';
  if (days === 1) return '내일 만료';
  return `D-${days} 만료`;
}
