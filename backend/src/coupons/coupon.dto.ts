import { senderDisplayName } from '../notification/notification-message.util';
import type { CouponStatus } from '../common/types/domain';

/**
 * 앱에 내려주는 쿠폰 표현.
 *
 * `docs/03-API-DB-스펙.md`는 응답을 `Coupon`이라고만 적고 형태를 정의하지 않았다.
 * `docs/06-모바일앱구조.md`의 목록·상세 화면이 실제로 쓰는 필드에 맞춰 정한다.
 */
export interface CouponDto {
  id: string;
  /** 발신자에서 뽑은 브랜드명 — 카드에 표시한다 */
  brandName: string;
  discount: string | null;
  /** ISO 날짜(YYYY-MM-DD). 없으면 null */
  expiryDate: string | null;
  conditions: string | null;
  status: CouponStatus;
  /**
   * 원본 메일 링크. 본문을 저장하지 않으므로 원문은 항상 메일 제공자로 보낸다
   * (`docs/06-모바일앱구조.md` "원본 메일 보기").
   */
  sourceMailUrl: string;
  createdAt: string;
}

export interface CouponRow {
  id: string;
  discount: string | null;
  expiryDate: Date | null;
  conditions: string | null;
  status: string | null;
  createdAt: Date;
  processedMail: { sender: string; providerMessageId: string };
}

/** Gmail 웹에서 해당 메일을 여는 링크. 모바일에서는 Gmail 앱이 받아 처리한다. */
function gmailUrl(providerMessageId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${providerMessageId}`;
}

export function toCouponDto(row: CouponRow): CouponDto {
  return {
    id: row.id,
    brandName: senderDisplayName(row.processedMail.sender),
    discount: row.discount,
    expiryDate: row.expiryDate
      ? row.expiryDate.toISOString().slice(0, 10)
      : null,
    conditions: row.conditions,
    status: (row.status ?? 'active') as CouponStatus,
    sourceMailUrl: gmailUrl(row.processedMail.providerMessageId),
    createdAt: row.createdAt.toISOString(),
  };
}
