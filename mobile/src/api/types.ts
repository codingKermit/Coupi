/**
 * 서버 응답 타입. `docs/03-API-DB-스펙.md`의 정의를 그대로 옮긴다.
 * 서버가 바뀌면 여기도 함께 바꾼다 — 어긋나면 런타임에야 드러난다.
 */

export type CouponStatus = 'active' | 'expired' | 'used' | 'dismissed';

export interface Coupon {
  id: string;
  /** 발신자에서 뽑은 브랜드명 */
  brandName: string;
  discount: string | null;
  /** ISO 날짜 (YYYY-MM-DD) */
  expiryDate: string | null;
  conditions: string | null;
  status: CouponStatus;
  /** 원본 메일 링크 — 본문을 저장하지 않으므로 항상 메일 제공자로 보낸다 */
  sourceMailUrl: string;
  createdAt: string;
}

/** 목록 화면의 탭 (`docs/06-모바일앱구조.md` "쿠폰 목록") */
export type CouponFilter = 'active' | 'expiring' | 'expired';

export interface ConnectResult {
  mailAccountId: string;
  email: string;
  /** 앱 세션 토큰 */
  accessToken: string;
}
