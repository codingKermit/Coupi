import { Injectable } from '@nestjs/common';

import type { ExtractedCoupon } from './extractors/coupon-extractor.interface';

/** KST는 DST가 없어 UTC+9 고정이다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type ValidityVerdict =
  /** 발송 대상 */
  | 'usable'
  /** 스팸성 문구 — 폐기 */
  | 'spam'
  /** 만료일 파싱 실패 — 보류(미발송), 파서 보강 대상 */
  | 'extraction_failed'
  /** 만료됨 — 폐기 */
  | 'expired';

export interface ValidityResult {
  usableNow: boolean;
  verdict: ValidityVerdict;
}

/** Date를 KST 기준 YYYY-MM-DD 문자열로 만든다. */
export function toKstDateString(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 파이프라인 3단계 — 유효성 판정 (`docs/02-쿠폰판별로직.md`).
 *
 * 100% 결정론적이다. LLM 버전에 있던 confidence는 없애고, 신뢰도는 `extractorId`
 * (전용 파서인지 범용 파서인지)로 대신 표현한다.
 */
@Injectable()
export class ValidityCheckerService {
  /**
   * @param now 판정 기준 시각. 테스트에서 고정할 수 있게 주입받는다.
   */
  check(coupon: ExtractedCoupon, now: Date = new Date()): ValidityResult {
    // 1. 스팸성 문구가 있으면 나머지를 보지 않는다.
    if (coupon.isSpammy) {
      return { usableNow: false, verdict: 'spam' };
    }

    // 2. 만료일을 못 찾으면 보수적으로 보류한다. 잘못된 알림보다 미발송이 낫다.
    if (!coupon.expiryDate) {
      return { usableNow: false, verdict: 'extraction_failed' };
    }

    // 3. 만료일이 오늘보다 이전이면 폐기. 날짜 문자열 비교로 충분하다 (둘 다 YYYY-MM-DD).
    if (coupon.expiryDate < toKstDateString(now)) {
      return { usableNow: false, verdict: 'expired' };
    }

    return { usableNow: true, verdict: 'usable' };
  }
}
