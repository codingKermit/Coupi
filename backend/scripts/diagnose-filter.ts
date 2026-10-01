/**
 * 규칙 필터 통과율 진단 (`docs/02-쿠폰판별로직.md` 1단계 검증용).
 *
 * 집계에서 통과율이 2.6%로 낮게 나와, 원인이 "받은메일함에 프로모션 메일이 적어서"인지
 * "필터가 놓치고 있어서"인지 가린다.
 *
 * 비교 대상:
 *   A. 현재 필터 — 발신자 도메인 + 제목 키워드 (수집 경로와 동일)
 *   B. 본문까지 포함한 키워드 매칭
 *   C. Gmail이 자체 분류한 프로모션 카테고리
 *
 * **제목·본문은 출력하지 않는다** (`docs/07-보안개인정보.md`).
 */

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { GmailProvider } from '../src/auth/gmail.provider';
import { MailAccountTokenService } from '../src/auth/mail-account-token.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RuleFilterService } from '../src/coupon-classifier/rule-filter.service';
import { extractSenderDomain } from '../src/coupon-classifier/sender.util';
import { toPlainText } from '../src/auth/gmail-message.util';

const DAYS = Number(process.argv[2] ?? 90);
/** 본문 비교는 호출 비용이 크므로 표본만 본다. */
const BODY_SAMPLE = Number(process.argv[3] ?? 120);

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = ctx.get(PrismaService);
    const tokens = ctx.get(MailAccountTokenService);
    const gmail = ctx.get(GmailProvider);
    const ruleFilter = ctx.get(RuleFilterService);

    const account = await prisma.mailAccount.findFirst({
      where: { provider: 'gmail', status: 'active' },
      select: { id: true },
    });
    if (!account) return console.log('활성 계정 없음');

    const loaded = await tokens.loadActive(account.id);
    if (!loaded) return console.log('계정 로드 실패');

    const since = new Date(Date.now() - DAYS * 86_400_000);
    const { messages } = await gmail.fetchMessagesSince(loaded.token, since);

    // 발신자별 전체 분포 — 필터와 무관하게 무엇이 들어오는지 본다.
    const byDomain = new Map<string, number>();
    for (const m of messages) {
      const d = extractSenderDomain(m.from) ?? '(알 수 없음)';
      byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
    }

    console.log(`\n최근 ${DAYS}일 / 받은메일함 ${messages.length}건`);
    console.log(`발신자 도메인 ${byDomain.size}곳\n`);
    console.log('상위 발신자 (전체 기준)');
    console.log('-'.repeat(50));
    for (const [d, n] of [...byDomain.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)) {
      console.log(`  ${d.padEnd(36)} ${n}`);
    }

    // A: 현재 필터 (메타데이터만)
    let passA = 0;
    for (const m of messages) {
      const r = await ruleFilter.apply({
        userId: loaded.userId,
        sender: m.from,
        subject: m.subject,
      });
      if (r.passed) passA += 1;
    }

    // B: 본문까지 포함 — 표본만
    const sample = messages.slice(0, BODY_SAMPLE);
    let passB = 0;
    let passAinSample = 0;
    for (const m of sample) {
      const a = await ruleFilter.apply({
        userId: loaded.userId,
        sender: m.from,
        subject: m.subject,
      });
      if (a.passed) passAinSample += 1;

      const body = await gmail.fetchMessageBody(
        loaded.token,
        m.providerMessageId,
      );
      const b = await ruleFilter.apply({
        userId: loaded.userId,
        sender: m.from,
        subject: m.subject,
        bodyText: toPlainText(body),
      });
      if (b.passed) passB += 1;
    }

    const pct = (n: number, d: number) =>
      d === 0 ? '-' : `${((n / d) * 100).toFixed(1)}%`;

    console.log('\n필터 비교');
    console.log('-'.repeat(50));
    console.log(`  A. 현재(제목+발신자) 전체 ${messages.length}건 중 ${passA}건 통과 (${pct(passA, messages.length)})`);
    console.log(`  표본 ${sample.length}건 기준`);
    console.log(`    A. 제목만      ${passAinSample}건 (${pct(passAinSample, sample.length)})`);
    console.log(`    B. 본문 포함   ${passB}건 (${pct(passB, sample.length)})`);
    console.log(`    → 본문을 보면 ${passB - passAinSample}건을 더 잡는다`);
  } finally {
    await ctx.close();
  }
}

main().catch((e: unknown) => {
  console.error('실패:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
