import { CouponsService, EXPIRING_WITHIN_DAYS } from './coupons.service';

const NOW = new Date('2026-09-30T09:00:00+09:00');
const USER = 'user-1';

const build = () => {
  const queries: { where: unknown; orderBy: unknown }[] = [];

  const prisma = {
    coupon: {
      findMany: jest.fn(async (args: never) => {
        queries.push(args as { where: unknown; orderBy: unknown });
        return [];
      }),
      findFirst: jest.fn(async (args: never) => {
        queries.push(args as { where: unknown; orderBy: unknown });
        return null;
      }),
    },
  };

  return { service: new CouponsService(prisma as never), queries };
};

describe('CouponsService — 필터', () => {
  it('기본은 사용 가능 쿠폰만 (만료일 없는 것 포함)', async () => {
    const { service, queries } = build();
    await service.list(USER, undefined, undefined, NOW);

    expect(queries[0].where).toMatchObject({
      userId: USER,
      status: 'active',
      OR: [{ expiryDate: null }, { expiryDate: { gte: new Date('2026-09-30T00:00:00Z') } }],
    });
  });

  it('만료 임박은 오늘부터 D-3까지로 좁힌다', async () => {
    const { service, queries } = build();
    await service.list(USER, 'expiring', undefined, NOW);

    const where = queries[0].where as {
      expiryDate: { gte: Date; lte: Date };
    };

    expect(where.expiryDate.gte).toEqual(new Date('2026-09-30T00:00:00Z'));
    expect(where.expiryDate.lte).toEqual(
      new Date(
        new Date('2026-09-30T00:00:00Z').getTime() +
          EXPIRING_WITHIN_DAYS * 86_400_000,
      ),
    );
  });

  it('지난 쿠폰은 상태가 expired거나 만료일이 지난 것', async () => {
    const { service, queries } = build();
    await service.list(USER, 'expired', undefined, NOW);

    expect(queries[0].where).toMatchObject({
      OR: [
        { status: 'expired' },
        { expiryDate: { lt: new Date('2026-09-30T00:00:00Z') } },
      ],
    });
  });
});

describe('CouponsService — 정렬', () => {
  it('기본은 만료일 오름차순, 만료일 없는 건 뒤로', async () => {
    const { service, queries } = build();
    await service.list(USER, undefined, undefined, NOW);

    expect(queries[0].orderBy).toEqual([
      { expiryDate: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ]);
  });

  it('created_desc를 주면 최신순', async () => {
    const { service, queries } = build();
    await service.list(USER, undefined, 'created_desc', NOW);

    expect(queries[0].orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('CouponsService — 상세', () => {
  it('userId를 조건에 넣어 남의 쿠폰을 막는다', async () => {
    const { service, queries } = build();
    await service.findOne(USER, 'c-1');

    expect(queries[0].where).toEqual({ id: 'c-1', userId: USER });
  });

  it('없으면 null', async () => {
    const { service } = build();
    expect(await service.findOne(USER, 'c-1')).toBeNull();
  });
});
