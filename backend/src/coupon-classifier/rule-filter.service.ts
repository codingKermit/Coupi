import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';
import { extractSenderDomain, matchesDomain } from './sender.util';

/**
 * 키워드 가중치 합이 이 값 이상이면 통과. 베타 단계에서 오탐지 실측 후 조정한다
 * (`docs/02-쿠폰판별로직.md` "운영 중 정확도 측정 방법").
 */
export const MIN_KEYWORD_SCORE = 1;

/** 규칙 캐시 유효 시간. 필터 규칙은 거의 바뀌지 않으므로 매 메일마다 조회하지 않는다. */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface RuleFilterInput {
  userId: string;
  sender: string;
  subject: string;
  bodyText?: string;
}

export type RuleFilterReason =
  | 'domain_whitelist'
  | 'keyword_match'
  | 'no_match';

export interface RuleFilterResult {
  passed: boolean;
  reason: RuleFilterReason;
  matchedDomain?: string;
  matchedKeywords?: string[];
  keywordScore?: number;
}

interface RuleCache {
  loadedAt: number;
  globalDomains: string[];
  userDomains: Map<string, string[]>;
  keywords: { keyword: string; weight: number }[];
}

const stripWhitespace = (value: string): string => value.replace(/\s+/g, '');

/**
 * 파이프라인 1단계 — 도메인 화이트리스트 + 키워드 매칭 (`docs/02-쿠폰판별로직.md`).
 *
 * 여기서 걸러진 메일은 DB에 기록조차 남기지 않는다. 대부분의 메일이 여기서 폐기되므로
 * 이후 단계의 처리량을 결정하는 지점이다.
 */
@Injectable()
export class RuleFilterService {
  private readonly logger = new Logger(RuleFilterService.name);
  private cache: RuleCache | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async apply(input: RuleFilterInput): Promise<RuleFilterResult> {
    const rules = await this.getRules();
    const senderDomain = extractSenderDomain(input.sender);

    // 1. 도메인 우선 — 등록된 발신자는 키워드를 보지 않고 통과시킨다.
    if (senderDomain) {
      const candidates = [
        ...rules.globalDomains,
        ...(rules.userDomains.get(input.userId) ?? []),
      ];
      const matched = candidates.find((d) => matchesDomain(senderDomain, d));

      if (matched) {
        return {
          passed: true,
          reason: 'domain_whitelist',
          matchedDomain: matched,
        };
      }
    }

    // 2. 키워드 매칭 — 화이트리스트에 없는 발신자에게도 기회를 준다.
    const text = `${input.subject}\n${input.bodyText ?? ''}`.toLowerCase();
    // 시드 키워드에는 `%할인`, `% off`처럼 공백 유무가 갈리는 표기가 섞여 있다.
    // 공백을 지운 사본도 함께 보면 `15% 할인`과 `15%할인`을 모두 잡는다.
    const compact = stripWhitespace(text);

    const matchedKeywords: string[] = [];
    let keywordScore = 0;

    for (const { keyword, weight } of rules.keywords) {
      const needle = keyword.toLowerCase();
      const hit =
        text.includes(needle) || compact.includes(stripWhitespace(needle));

      if (hit) {
        matchedKeywords.push(keyword);
        keywordScore += weight;
      }
    }

    if (keywordScore >= MIN_KEYWORD_SCORE) {
      return {
        passed: true,
        reason: 'keyword_match',
        matchedKeywords,
        keywordScore,
      };
    }

    return { passed: false, reason: 'no_match', keywordScore };
  }

  /** 규칙을 바꾼 직후 즉시 반영하고 싶을 때 호출한다. */
  invalidateCache(): void {
    this.cache = null;
  }

  private async getRules(): Promise<RuleCache> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache;
    }

    const [domains, keywords] = await Promise.all([
      this.prisma.filterDomain.findMany({
        select: { domain: true, isGlobal: true, userId: true },
      }),
      this.prisma.filterKeyword.findMany({
        select: { keyword: true, weight: true },
      }),
    ]);

    const globalDomains: string[] = [];
    const userDomains = new Map<string, string[]>();

    for (const row of domains) {
      if (row.isGlobal !== false) {
        globalDomains.push(row.domain);
        continue;
      }
      if (!row.userId) continue;

      const list = userDomains.get(row.userId) ?? [];
      list.push(row.domain);
      userDomains.set(row.userId, list);
    }

    this.cache = {
      loadedAt: Date.now(),
      globalDomains,
      userDomains,
      keywords: keywords.map((k) => ({
        keyword: k.keyword,
        weight: k.weight ?? 1,
      })),
    };

    this.logger.debug(
      `필터 규칙 로드: 전역 도메인 ${globalDomains.length}, 키워드 ${keywords.length}`,
    );

    return this.cache;
  }
}
