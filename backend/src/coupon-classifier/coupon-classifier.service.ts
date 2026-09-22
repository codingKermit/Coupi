import { Injectable, Logger } from '@nestjs/common';

import { ExtractorRegistry } from './extractors/extractor-registry.service';
import { RuleFilterService, type RuleFilterResult } from './rule-filter.service';
import {
  ValidityCheckerService,
  type ValidityResult,
} from './validity-checker.service';
import { extractSenderDomain } from './sender.util';
import type { ExtractedCoupon } from './extractors/coupon-extractor.interface';
import type { ExtractorType, FilterResult } from '../common/types/domain';

/** 2~3단계(추출·판정)에 필요한 입력. */
export interface ExtractInput {
  sender: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
}

/** 1단계(규칙 필터)까지 포함한 전체 입력. */
export interface ClassifyInput extends ExtractInput {
  userId: string;
}

export interface ExtractOutcome {
  /** processed_mails.filter_result에 기록할 값 */
  filterResult: FilterResult;
  extracted: ExtractedCoupon | null;
  /** coupons.extractor_type에 기록할 값 (어느 파서가 처리했는지) */
  extractorType: ExtractorType | null;
  validity: ValidityResult | null;
  /** 쿠폰 레코드를 만들고 푸시 큐로 보낼지 여부 */
  shouldNotify: boolean;
}

export interface ClassifyOutput extends ExtractOutcome {
  ruleFilter: RuleFilterResult;
}

/**
 * 쿠폰 판별 파이프라인 (`docs/02-쿠폰판별로직.md`).
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

  /** 1~3단계 전체. */
  async classify(
    input: ClassifyInput,
    now: Date = new Date(),
  ): Promise<ClassifyOutput> {
    const ruleFilter = await this.ruleFilter.apply(input);

    // 1단계에서 걸리면 DB 기록 없이 폐기한다 (docs/02).
    if (!ruleFilter.passed) {
      return {
        filterResult: 'filtered_out',
        extractorType: null,
        ruleFilter,
        extracted: null,
        validity: null,
        shouldNotify: false,
      };
    }

    return { ...this.extractAndJudge(input, now), ruleFilter };
  }

  /**
   * 2~3단계만 수행한다.
   *
   * 수집 단계에서 이미 규칙 필터를 통과한 메일을 판별할 때 쓴다 — 같은 필터를
   * 두 번 돌릴 이유가 없다 (`docs/05` 파이프라인: mail-ingest → coupon-classify).
   */
  extractAndJudge(input: ExtractInput, now: Date = new Date()): ExtractOutcome {
    // 2단계 — 발신자 전용 파서가 있으면 그것을, 없으면 범용 파서를 쓴다.
    const senderDomain = extractSenderDomain(input.sender) ?? '';
    const extractor = this.extractors.resolve(senderDomain);
    const extracted = extractor.extract(input.subject, input.bodyText, {
      receivedAt: input.receivedAt,
    });

    // 전용 파서가 "내 포맷이 아니다"라고 판단한 경우. 보류 대상이다.
    if (!extracted) {
      return {
        filterResult: 'extraction_failed',
        extractorType: extractor.extractorType,
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
        validity.verdict === 'extraction_failed'
          ? 'extraction_failed'
          : 'passed',
      extracted,
      extractorType: extractor.extractorType,
      validity,
      shouldNotify: validity.usableNow,
    };
  }
}
