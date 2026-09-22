/**
 * 쿠폰 추출기 계약. 기준 정의는 `docs/02-쿠폰판별로직.md`.
 *
 * MVP는 LLM을 쓰지 않는다 (`docs/00-개요.md` 결정 #1). 'llm' 타입은 향후 확장용으로만 남겨둔다.
 */

import type { ExtractorType } from '../../common/types/domain';

export interface ExtractedCoupon {
  discount: string | null;
  /** ISO 8601 (YYYY-MM-DD). 파싱 실패 시 null → 발송하지 않고 보류한다 */
  expiryDate: string | null;
  conditions: string | null;
  /** 스팸성 문구 매칭 여부 */
  isSpammy: boolean;
  /** 어떤 파서가 처리했는지 (예: 'coupang_v1', 'generic_v1') */
  extractorId: string;
}

export interface CouponExtractor {
  readonly extractorType: ExtractorType;
  canHandle(senderDomain: string): boolean;
  extract(subject: string, bodyText: string): ExtractedCoupon | null;
}

/** DI 토큰 — 등록된 추출기 목록을 주입받는다 */
export const COUPON_EXTRACTORS = Symbol('COUPON_EXTRACTORS');
