import { CouponClassifierService } from './coupon-classifier.service';
import { ExtractorRegistry } from './extractors/extractor-registry.service';
import { GenericRegexExtractor } from './extractors/generic-regex.extractor';
import { RuleFilterService } from './rule-filter.service';
import { ValidityCheckerService } from './validity-checker.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type {
  CouponExtractor,
  ExtractedCoupon,
} from './extractors/coupon-extractor.interface';

const USER = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-09-22T09:00:00+09:00');

const buildService = (senderExtractors: CouponExtractor[] = []) => {
  const prisma = {
    filterDomain: {
      findMany: async () => [
        { domain: 'coupang.com', isGlobal: true, userId: null },
      ],
    },
    filterKeyword: {
      findMany: async () => [{ keyword: '쿠폰', weight: 1 }],
    },
  } as unknown as PrismaService;

  const generic = new GenericRegexExtractor();
  return new CouponClassifierService(
    new RuleFilterService(prisma),
    new ExtractorRegistry(generic, senderExtractors),
    new ValidityCheckerService(),
  );
};

const classify = (
  service: CouponClassifierService,
  overrides: Partial<Parameters<CouponClassifierService['classify']>[0]> = {},
) =>
  service.classify(
    {
      userId: USER,
      sender: '쿠팡 <no-reply@coupang.com>',
      subject: '15% 할인 쿠폰 도착',
      bodyText: '30,000원 이상 구매 시. 10/15까지.',
      receivedAt: NOW,
      ...overrides,
    },
    NOW,
  );

describe('CouponClassifierService — 전체 파이프라인', () => {
  it('화이트리스트 발신자의 유효한 쿠폰은 발송 대상이 된다', async () => {
    const result = await classify(buildService());

    expect(result.filterResult).toBe('passed');
    expect(result.ruleFilter.reason).toBe('domain_whitelist');
    expect(result.extracted?.discount).toBe('15%');
    expect(result.validity?.verdict).toBe('usable');
    expect(result.shouldNotify).toBe(true);
  });

  it('규칙 필터에서 걸리면 이후 단계를 건너뛴다', async () => {
    const result = await classify(buildService(), {
      sender: 'friend@gmail.com',
      subject: '주말에 뭐해?',
      bodyText: '영화 볼래?',
    });

    expect(result.filterResult).toBe('filtered_out');
    expect(result.extracted).toBeNull();
    expect(result.validity).toBeNull();
    expect(result.shouldNotify).toBe(false);
  });

  it('만료일을 못 찾으면 extraction_failed로 보류한다', async () => {
    const result = await classify(buildService(), {
      subject: '쿠폰 도착',
      bodyText: '앱에서 확인하세요',
    });

    expect(result.filterResult).toBe('extraction_failed');
    expect(result.shouldNotify).toBe(false);
  });

  it('만료된 쿠폰은 발송하지 않지만 보류로 처리하지도 않는다', async () => {
    const result = await classify(buildService(), {
      bodyText: '2026-09-01까지',
      receivedAt: new Date('2026-08-25T09:00:00+09:00'),
    });

    expect(result.filterResult).toBe('passed');
    expect(result.validity?.verdict).toBe('expired');
    expect(result.shouldNotify).toBe(false);
  });

  it('스팸성 메일은 발송하지 않는다', async () => {
    const result = await classify(buildService(), {
      subject: '설문조사 참여하고 쿠폰 받기',
      bodyText: '10/15까지',
    });

    expect(result.validity?.verdict).toBe('spam');
    expect(result.shouldNotify).toBe(false);
  });
});

describe('CouponClassifierService — 전용 파서 우선', () => {
  const coupangExtractor: CouponExtractor = {
    extractorType: 'sender_specific',
    canHandle: (domain) => domain === 'coupang.com',
    extract: (): ExtractedCoupon => ({
      discount: '전용파서결과',
      expiryDate: '2026-10-15',
      conditions: null,
      isSpammy: false,
      extractorId: 'coupang_v1',
    }),
  };

  it('전용 파서가 있으면 범용 파서 대신 사용한다', async () => {
    const result = await classify(buildService([coupangExtractor]));

    expect(result.extracted?.extractorId).toBe('coupang_v1');
    expect(result.extracted?.discount).toBe('전용파서결과');
  });

  it('전용 파서가 없는 발신자는 범용 파서로 폴백한다', async () => {
    const result = await classify(buildService([coupangExtractor]), {
      sender: 'promo@unknown-shop.com',
      subject: '15% 할인 쿠폰',
      bodyText: '10/15까지',
    });

    expect(result.extracted?.extractorId).toBe('generic_v1');
  });

  it('전용 파서가 null을 반환하면 보류 처리한다', async () => {
    const pickyExtractor: CouponExtractor = {
      extractorType: 'sender_specific',
      canHandle: () => true,
      extract: () => null,
    };
    const result = await classify(buildService([pickyExtractor]));

    expect(result.filterResult).toBe('extraction_failed');
    expect(result.extracted).toBeNull();
  });
});
