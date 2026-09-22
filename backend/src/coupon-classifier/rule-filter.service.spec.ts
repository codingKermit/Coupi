import { RuleFilterService } from './rule-filter.service';
import type { PrismaService } from '../common/prisma/prisma.service';

interface DomainRow {
  domain: string;
  isGlobal: boolean | null;
  userId: string | null;
}
interface KeywordRow {
  keyword: string;
  weight: number | null;
}

const fakePrisma = (
  domains: DomainRow[],
  keywords: KeywordRow[],
): { prisma: PrismaService; counts: { domains: number; keywords: number } } => {
  const counts = { domains: 0, keywords: 0 };
  const prisma = {
    filterDomain: {
      findMany: jest.fn(async () => {
        counts.domains += 1;
        return domains;
      }),
    },
    filterKeyword: {
      findMany: jest.fn(async () => {
        counts.keywords += 1;
        return keywords;
      }),
    },
  } as unknown as PrismaService;

  return { prisma, counts };
};

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';

describe('RuleFilterService — 도메인 우선', () => {
  it('화이트리스트 발신자는 키워드 없이 통과한다', async () => {
    const { prisma } = fakePrisma(
      [{ domain: 'coupang.com', isGlobal: true, userId: null }],
      [],
    );
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: '쿠팡 <no-reply@coupang.com>',
      subject: '안내드립니다',
    });

    expect(result).toEqual({
      passed: true,
      reason: 'domain_whitelist',
      matchedDomain: 'coupang.com',
    });
  });

  it('서브도메인 발신자도 통과한다', async () => {
    const { prisma } = fakePrisma(
      [{ domain: 'coupang.com', isGlobal: true, userId: null }],
      [],
    );
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'no-reply@mail.coupang.com',
      subject: '안내',
    });

    expect(result.passed).toBe(true);
  });

  it('사용자 개인 도메인은 그 사용자에게만 적용된다', async () => {
    const { prisma } = fakePrisma(
      [{ domain: 'mystore.com', isGlobal: false, userId: USER }],
      [],
    );
    const service = new RuleFilterService(prisma);

    const mine = await service.apply({
      userId: USER,
      sender: 'a@mystore.com',
      subject: '안내',
    });
    const others = await service.apply({
      userId: OTHER_USER,
      sender: 'a@mystore.com',
      subject: '안내',
    });

    expect(mine.passed).toBe(true);
    expect(others.passed).toBe(false);
  });
});

describe('RuleFilterService — 키워드 매칭', () => {
  it('키워드 가중치 합이 기준을 넘으면 통과한다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: '쿠폰', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'promo@unknown-shop.com',
      subject: '할인 쿠폰 도착',
    });

    expect(result.passed).toBe(true);
    expect(result.reason).toBe('keyword_match');
    expect(result.matchedKeywords).toEqual(['쿠폰']);
    expect(result.keywordScore).toBe(1);
  });

  it('가중치가 부족하면 걸러낸다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: '쿠폰', weight: 0 }]);
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'promo@unknown-shop.com',
      subject: '쿠폰 안내',
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('no_match');
  });

  it('본문에서도 키워드를 찾는다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: '무료배송', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'promo@unknown-shop.com',
      subject: '안내',
      bodyText: '이번 주말 무료배송 이벤트',
    });

    expect(result.passed).toBe(true);
  });

  it('영문 키워드는 대소문자를 가리지 않는다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: 'promo code', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'promo@shop.com',
      subject: 'Your PROMO CODE is here',
    });

    expect(result.passed).toBe(true);
  });

  it('아무것도 일치하지 않으면 걸러낸다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: '쿠폰', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'friend@gmail.com',
      subject: '주말에 뭐해?',
    });

    expect(result.passed).toBe(false);
  });
});

describe('RuleFilterService — 캐시', () => {
  it('규칙을 매번 다시 조회하지 않는다', async () => {
    const { prisma, counts } = fakePrisma([], [{ keyword: '쿠폰', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    await service.apply({ userId: USER, sender: 'a@b.com', subject: '쿠폰' });
    await service.apply({ userId: USER, sender: 'a@b.com', subject: '쿠폰' });

    expect(counts.keywords).toBe(1);
  });

  it('invalidateCache 후에는 다시 조회한다', async () => {
    const { prisma, counts } = fakePrisma([], [{ keyword: '쿠폰', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    await service.apply({ userId: USER, sender: 'a@b.com', subject: '쿠폰' });
    service.invalidateCache();
    await service.apply({ userId: USER, sender: 'a@b.com', subject: '쿠폰' });

    expect(counts.keywords).toBe(2);
  });
});

describe('RuleFilterService — 공백 표기 차이', () => {
  it('`%할인` 키워드가 `15% 할인`(공백 포함)도 잡는다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: '%할인', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    const spaced = await service.apply({
      userId: USER,
      sender: 'promo@shop.com',
      subject: '15% 할인 이벤트',
    });
    const tight = await service.apply({
      userId: USER,
      sender: 'promo@shop.com',
      subject: '15%할인 이벤트',
    });

    expect(spaced.passed).toBe(true);
    expect(tight.passed).toBe(true);
  });

  it('`% off` 키워드가 `20%off`도 잡는다', async () => {
    const { prisma } = fakePrisma([], [{ keyword: '% off', weight: 1 }]);
    const service = new RuleFilterService(prisma);

    const result = await service.apply({
      userId: USER,
      sender: 'promo@shop.com',
      subject: 'Get 20%off today',
    });

    expect(result.passed).toBe(true);
  });
});
