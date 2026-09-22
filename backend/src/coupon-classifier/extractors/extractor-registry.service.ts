import { Inject, Injectable, Optional } from '@nestjs/common';

import { GenericRegexExtractor } from './generic-regex.extractor';
import {
  SENDER_EXTRACTORS,
  type CouponExtractor,
} from './coupon-extractor.interface';

/**
 * 발신자 도메인에 맞는 추출기를 고른다.
 *
 * 전용 파서를 먼저 찾고, 없으면 범용 정규식 파서로 폴백한다 (`docs/02-쿠폰판별로직.md`).
 * 전용 파서 8종은 실제 메일 샘플을 수집한 뒤 작성한다 — 아직 비어 있는 게 정상이다
 * (docs/02 "초기 지원 발신자 선정 절차").
 */
@Injectable()
export class ExtractorRegistry {
  private readonly senderExtractors: CouponExtractor[];

  constructor(
    private readonly generic: GenericRegexExtractor,
    @Optional()
    @Inject(SENDER_EXTRACTORS)
    senderExtractors?: CouponExtractor[],
  ) {
    this.senderExtractors = senderExtractors ?? [];
  }

  resolve(senderDomain: string): CouponExtractor {
    const specific = this.senderExtractors.find((e) =>
      e.canHandle(senderDomain),
    );
    return specific ?? this.generic;
  }

  /** 등록된 전용 파서 수 — 대시보드의 커버리지 지표용 (docs/02) */
  get senderExtractorCount(): number {
    return this.senderExtractors.length;
  }
}
