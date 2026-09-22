import { Injectable } from '@nestjs/common';

import { parseExpiryDate } from './date-parser';
import {
  CONDITION_PATTERNS,
  DISCOUNT_PATTERNS,
  SPAM_PATTERNS,
} from './patterns';
import type {
  CouponExtractor,
  ExtractedCoupon,
  ExtractionContext,
} from './coupon-extractor.interface';

/**
 * 전용 파서가 없는 발신자를 처리하는 폴백 추출기 (`docs/02-쿠폰판별로직.md`).
 *
 * 전용 파서보다 정확도가 낮다는 것을 전제로 하고, `extractorId: 'generic_v1'`로 태깅해
 * 베타 단계에서 "전용 파서가 필요한 발신자"를 추적할 수 있게 한다.
 */
@Injectable()
export class GenericRegexExtractor implements CouponExtractor {
  readonly extractorType = 'generic_regex' as const;
  readonly extractorId = 'generic_v1';

  /** 폴백이므로 모든 발신자를 받는다. */
  canHandle(): boolean {
    return true;
  }

  extract(
    subject: string,
    bodyText: string,
    context?: ExtractionContext,
  ): ExtractedCoupon {
    // 제목에만 할인 정보가 있고 본문은 이미지인 메일이 많아 둘을 합쳐서 본다.
    const text = `${subject}\n${bodyText}`;
    const receivedAt = context?.receivedAt ?? new Date();

    const discount = this.matchFirst(text, DISCOUNT_PATTERNS);
    const conditions = this.matchFirst(text, CONDITION_PATTERNS);
    const expiryDate = parseExpiryDate(text, receivedAt);

    return {
      discount,
      expiryDate,
      conditions,
      isSpammy: this.isSpammy(text, discount),
      extractorId: this.extractorId,
    };
  }

  private matchFirst(
    text: string,
    patterns: { pattern: RegExp; format: (m: RegExpMatchArray) => string }[],
  ): string | null {
    for (const { pattern, format } of patterns) {
      const m = text.match(pattern);
      if (m) return format(m);
    }
    return null;
  }

  /**
   * `standalone` 문구는 할인 정보가 함께 있으면 스팸으로 보지 않는다.
   * 정상 쿠폰 메일도 "마지막 기회" 같은 마케팅 문구를 쓰기 때문이다 (docs/02).
   */
  private isSpammy(text: string, discount: string | null): boolean {
    return SPAM_PATTERNS.some(({ pattern, standalone }) => {
      if (!pattern.test(text)) return false;
      return standalone ? discount === null : true;
    });
  }
}
