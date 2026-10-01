/**
 * 초기 지원 발신자 집계 (`docs/02-쿠폰판별로직.md` "초기 지원 발신자 선정 절차").
 *
 * 연결된 Gmail 계정의 최근 N일 메일을 발신자 도메인별로 집계한다. 전용 파서를 만들
 * 8곳을 **추측이 아니라 데이터로** 고르기 위한 일회성 스크립트다.
 *
 * 함께 측정하는 것:
 *  - 현재 규칙 필터가 각 발신자의 메일을 통과시키는 비율
 *  - 범용 정규식 파서가 만료일을 뽑아내는 비율
 * 이 두 수치가 "전용 파서를 어디부터 쓸지"의 우선순위가 된다.
 *
 * 실행: npx ts-node scripts/aggregate-senders.ts [일수]
 *
 * **메일 제목과 본문은 출력하지 않는다** (`docs/07-보안개인정보.md` 로깅 원칙).
 * 집계 결과만 남긴다.
 */

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { GmailProvider } from '../src/auth/gmail.provider';
import { MailAccountTokenService } from '../src/auth/mail-account-token.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RuleFilterService } from '../src/coupon-classifier/rule-filter.service';
import { CouponClassifierService } from '../src/coupon-classifier/coupon-classifier.service';
import { extractSenderDomain } from '../src/coupon-classifier/sender.util';
import { toPlainText } from '../src/auth/gmail-message.util';

const DEFAULT_DAYS = 90;

interface SenderStats {
  domain: string;
  total: number;
  passedFilter: number;
  /** 규칙 필터를 통과한 것 중 만료일까지 뽑힌 건수 */
  extracted: number;
  /** 만료일 파싱 실패 — 전용 파서가 필요하다는 신호 */
  extractionFailed: number;
  spam: number;
}

function emptyStats(domain: string): SenderStats {
  return {
    domain,
    total: 0,
    passedFilter: 0,
    extracted: 0,
    extractionFailed: 0,
    spam: 0,
  };
}

async function main(): Promise<void> {
  const days = Number(process.argv[2] ?? DEFAULT_DAYS);
  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = ctx.get(PrismaService);
    const tokens = ctx.get(MailAccountTokenService);
    const gmail = ctx.get(GmailProvider);
    const ruleFilter = ctx.get(RuleFilterService);
    const classifier = ctx.get(CouponClassifierService);

    const accounts = await prisma.mailAccount.findMany({
      where: { provider: 'gmail', status: 'active' },
      select: { id: true },
    });

    if (accounts.length === 0) {
      console.log('활성 Gmail 계정이 없다. 먼저 /auth/gmail/url 로 연결할 것.');
      return;
    }

    const stats = new Map<string, SenderStats>();
    let scanned = 0;

    for (const account of accounts) {
      const loaded = await tokens.loadActive(account.id);
      if (!loaded) {
        console.log(`건너뜀: 계정 ${account.id} 비활성`);
        continue;
      }

      const since = new Date(Date.now() - days * 86_400_000);
      const { messages } = await gmail.fetchMessagesSince(loaded.token, since);
      console.log(`${loaded.providerAccountEmail}: ${messages.length}건 조회`);

      for (const message of messages) {
        scanned += 1;

        const domain = extractSenderDomain(message.from) ?? '(알 수 없음)';
        const entry = stats.get(domain) ?? emptyStats(domain);
        entry.total += 1;

        // 1단계 — 수집 경로와 동일하게 메타데이터만으로 거른다 (docs/01).
        const filtered = await ruleFilter.apply({
          userId: loaded.userId,
          sender: message.from,
          subject: message.subject,
        });

        if (filtered.passed) {
          entry.passedFilter += 1;

          // 통과한 것만 본문을 받아 2~3단계를 돌린다.
          const body = await gmail.fetchMessageBody(
            loaded.token,
            message.providerMessageId,
          );

          const outcome = classifier.extractAndJudge({
            sender: message.from,
            subject: message.subject,
            bodyText: toPlainText(body),
            receivedAt: message.receivedAt,
          });

          if (outcome.validity?.verdict === 'spam') entry.spam += 1;
          else if (outcome.filterResult === 'extraction_failed')
            entry.extractionFailed += 1;
          else entry.extracted += 1;
        }

        stats.set(domain, entry);
      }
    }

    report(stats, scanned, days);
  } finally {
    await ctx.close();
  }
}

function report(
  stats: Map<string, SenderStats>,
  scanned: number,
  days: number,
): void {
  const rows = [...stats.values()]
    .filter((r) => r.passedFilter > 0)
    .sort((a, b) => b.passedFilter - a.passedFilter);

  console.log(`\n최근 ${days}일 / 전체 ${scanned}건 스캔`);
  console.log(`규칙 필터 통과 발신자 ${rows.length}곳\n`);

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(
    pad('발신자 도메인', 34) +
      pad('전체', 6) +
      pad('통과', 6) +
      pad('추출', 6) +
      pad('보류', 6) +
      pad('스팸', 6),
  );
  console.log('-'.repeat(64));

  for (const r of rows.slice(0, 30)) {
    console.log(
      pad(r.domain, 34) +
        pad(r.total, 6) +
        pad(r.passedFilter, 6) +
        pad(r.extracted, 6) +
        pad(r.extractionFailed, 6) +
        pad(r.spam, 6),
    );
  }

  const totalPassed = rows.reduce((s, r) => s + r.passedFilter, 0);
  const totalFailed = rows.reduce((s, r) => s + r.extractionFailed, 0);

  console.log('-'.repeat(64));
  console.log(`필터 통과 ${totalPassed}건 중 만료일 파싱 실패 ${totalFailed}건`);
  console.log(
    '보류(실패) 건수가 많은 발신자부터 전용 파서를 만든다 (docs/02 "선정" 절차).',
  );
}

main().catch((e: unknown) => {
  console.error('실패:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
