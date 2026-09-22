import { Module } from '@nestjs/common';

import { CouponClassifierService } from './coupon-classifier.service';
import { ExtractorRegistry } from './extractors/extractor-registry.service';
import { GenericRegexExtractor } from './extractors/generic-regex.extractor';
import { RuleFilterService } from './rule-filter.service';
import { ValidityCheckerService } from './validity-checker.service';
import { SENDER_EXTRACTORS } from './extractors/coupon-extractor.interface';

@Module({
  providers: [
    RuleFilterService,
    GenericRegexExtractor,
    ExtractorRegistry,
    ValidityCheckerService,
    CouponClassifierService,
    {
      // 발신자 전용 파서 8종은 실제 메일 샘플 수집 후 여기에 추가한다
      // (docs/02-쿠폰판별로직.md "초기 지원 발신자 선정 절차").
      provide: SENDER_EXTRACTORS,
      useValue: [],
    },
  ],
  exports: [CouponClassifierService, RuleFilterService],
})
export class CouponClassifierModule {}
