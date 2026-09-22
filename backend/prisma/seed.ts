/**
 * 규칙 필터 초기 시드 데이터.
 *
 * 키워드 목록은 `docs/02-쿠폰판별로직.md` "초기 키워드 시드" 그대로다.
 * 도메인 화이트리스트는 **의도적으로 비어 있다** — 발신자 8곳은 실제 메일함 집계로
 * 정하기로 했고(docs/02 "초기 지원 발신자 선정 절차"), 근거 없이 채우면 헛수고가 된다.
 *
 * 실행: npx prisma db seed
 * 여러 번 돌려도 안전하다 (이미 있는 값은 건너뛴다).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** docs/02-쿠폰판별로직.md "초기 키워드 시드" */
const SEED_KEYWORDS: { keyword: string; lang: string; weight: number }[] = [
  { keyword: '쿠폰', lang: 'ko', weight: 1 },
  { keyword: '할인코드', lang: 'ko', weight: 1 },
  { keyword: '프로모션', lang: 'ko', weight: 1 },
  { keyword: '적립금', lang: 'ko', weight: 1 },
  { keyword: '%할인', lang: 'ko', weight: 1 },
  { keyword: '%OFF', lang: 'ko', weight: 1 },
  { keyword: '무료배송', lang: 'ko', weight: 1 },
  { keyword: '이벤트', lang: 'ko', weight: 1 },
  { keyword: 'coupon', lang: 'en', weight: 1 },
  { keyword: 'promo code', lang: 'en', weight: 1 },
  { keyword: 'discount code', lang: 'en', weight: 1 },
  { keyword: '% off', lang: 'en', weight: 1 },
  { keyword: 'special offer', lang: 'en', weight: 1 },
];

async function seedKeywords(): Promise<void> {
  let created = 0;

  for (const row of SEED_KEYWORDS) {
    const existing = await prisma.filterKeyword.findFirst({
      where: { keyword: row.keyword },
      select: { id: true },
    });

    if (existing) continue;

    await prisma.filterKeyword.create({ data: row });
    created += 1;
  }

  console.log(
    `filter_keywords: ${created}건 추가, ${SEED_KEYWORDS.length - created}건 이미 존재`,
  );
}

async function main(): Promise<void> {
  await seedKeywords();

  const domainCount = await prisma.filterDomain.count();
  if (domainCount === 0) {
    console.log(
      'filter_domains: 비어 있음 — 발신자 8곳은 메일함 집계 후 채운다 (docs/02 "초기 지원 발신자 선정 절차")',
    );
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
