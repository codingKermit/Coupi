import { Injectable, Logger } from '@nestjs/common';

import { ExtractorRegistry } from './extractors/extractor-registry.service';
import { RuleFilterService, type RuleFilterResult } from './rule-filter.service';
import { ValidityCheckerService, type ValidityResult } from './validity-checker.service';
import { extractSenderDomain } from './sender.util';
import type { ExtractedCoupon } from './extractors/coupon-extractor.interface';
import type { FilterResult } from '../common/types/domain';

export interface ClassifyInput {
  userId: string;
  sender: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
}

export interface ClassifyOutput {
  /** processed_mails.filter_result에 기록할 값 */
  filterResult: FilterResult;
  /** 규칙 필터를 통과하지 못하면 이후 단계를 건너뛴다 */
  ruleFilter: RuleFilterResult;
  extracted: ExtractedCoupon | null;
  validity: ValidityResult | null;
  /** 쿠폰 레코드를 만들고 푸시 큐로 보낼지 여부 */
  shouldNotify: boolean;
}

/**
 * 쿠폰 판별 파이프라인 전체 (`docs/02-쿠폰판별로직.md`).
 *
 *   규칙 필터 → 구조화 추출 → 유효성 판정
 *
 * DB 쓰기와 큐 발행은 하지 않는다. 호출하는 핸들러가 결과를 보고 처리한다 —
 * 판별 로직을 부수효과 없이 테스트할 수 있게 하기 위해서다.
 */
@Injectable()
export class CouponClassifierService {
  private readonly logger = new Logger(CouponClassifierService.name);

  constructor(
    private readonly ruleFilter: RuleFilterService,
    private readonly extractors: ExtractorRegistry,
    private readonly validityChecker: ValidityCheckerService,
  ) {}

  async classify(
    input: ClassifyInput,
    now: Date = new Date(),
  ): Promise<ClassifyOutput> {
    // 1단계 — 규칙 필터. 불일치면 DB 기록 없이 폐기한다.
    const ruleFilter = await this.ruleFilter.apply(input);

    if (!ruleFilter.passed) {
      return {
        filterResult: 'filtered_out',
        ruleFilter,
        extracted: null,
        validity: null,
        shouldNotify: false,
      };
    }

    // 2단계 — 구조화 추출. 발신자 전용 파서가 있으면 그것을, 없으면 범용 파서를 쓴다.
    const senderDomain = extractSenderDomain(input.sender) ?? '';
    const extractor = this.extractors.resolve(senderDomain);
    const extracted = extractor.extract(input.subject, input.bodyText, {
      receivedAt: input.receivedAt,
    });

    if (!extracted) {
      // 전용 파서가 "내 포맷이 아니다"라고 판단한 경우. 보류 대상이다.
      return {
        filterResult: 'extraction_failed',
        ruleFilter,
        extracted: null,
        validity: null,
        shouldNotify: false,
      };
    }

    // 3단계 — 유효성 판정.
    const validity = this.validityChecker.check(extracted, now);

    if (validity.verdict === 'extraction_failed') {
      this.logger.debug(
        `만료일 파싱 실패 — sender=${senderDomain} extractor=${extracted.extractorId}`,
      );
    }

    return {
      filterResult:
        validity.verdict === 'extraction_failed' ? 'extraction_failed' : 'passed',
      ruleFilter,
      extracted,
      validity,
      shouldNotify: validity.usableNow,
    };
  }
}
