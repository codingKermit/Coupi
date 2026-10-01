/**
 * 추출 품질 측정 (`docs/02-쿠폰판별로직.md` "운영 중 정확도 측정 방법").
 *
 * Gmail이 프로모션으로 분류한 메일에 2~3단계(추출·판정)를 그대로 돌려,
 * 범용 정규식 파서가 실제로 무엇을 뽑아내는지 센다. 전용 파서를 어디부터
 * 만들지 정하는 근거다.
 *
 * 실행: npx ts-node scripts/measure-extraction.ts [일수]
 *
 * **제목·본문은 출력하지 않는다** (`docs/07-보안개인정보.md`). 집계와
 * 추출된 필드의 유무만 남긴다.
 */

import { NestFactory } from '@nestjs/core';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

import { AppModule } from '../src/app.module';
import { CouponClassifierService } from '../src/coupon-classifier/coupon-classifier.service';
import { GmailProvider } from '../src/auth/gmail.provider';
import { MailAccountTokenService } from '../src/auth/mail-account-token.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { extractSenderDomain } from '../src/coupon-classifier/sender.util';
import { toPlainText, getHeader } from '../src/auth/gmail-message.util';

const DAYS = Number(process.argv[2] ?? 90);

interface Row {
  domain: string;
  total: number;
  usable: number;
  /** 만료일을 못 찾아 보류 — 전용 파서 1순위 신호 */
  extractionFailed: number;
  expired: number;
  spam: number;
  discountFound: number;
  conditionsFound: number;
}

const empty = (domain: string): Row => ({
  domain,
  total: 0,
  usable: 0,
  extractionFailed: 0,
  expired: 0,
  spam: 0,
  discountFound: 0,
  conditionsFound: 0,
});

async function main(): Promise<void> {
  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = ctx.get(PrismaService);
    const tokens = ctx.get(MailAccountTokenService);
    const provider = ctx.get(GmailProvider);
    const classifier = ctx.get(CouponClassifierService);

    const account = await prisma.mailAccount.findFirst({
      where: { provider: 'gmail', status: 'active' },
      select: { id: true },
    });
    if (!account) return console.log('활성 계정 없음');

    const loaded = await tokens.loadActive(account.id);
    if (!loaded) return console.log('계정 로드 실패');

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: loaded.token.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const since = Math.floor((Date.now() - DAYS * 86_400_000) / 1000);
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        q: `in:inbox category:promotions after:${since}`,
        maxResults: 100,
        pageToken,
      });
      for (const m of data.messages ?? []) if (m.id) ids.push(m.id);
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    console.log(`Gmail 프로모션 분류 ${ids.length}건에 추출 파이프라인 실행\n`);

    const rows = new Map<string, Row>();

    for (const id of ids) {
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = data.payload?.headers ?? undefined;
      const from = getHeader(headers, 'From') ?? '';
      const subject = getHeader(headers, 'Subject') ?? '';
      const receivedAt = data.internalDate
        ? new Date(Number(data.internalDate))
        : new Date();

      const domain = extractSenderDomain(from) ?? '(알 수 없음)';
      const row = rows.get(domain) ?? empty(domain);
      row.total += 1;

      const body = await provider.fetchMessageBody(loaded.token, id);
      const outcome = classifier.extractAndJudge({
        sender: from,
        subject,
        bodyText: toPlainText(body),
        receivedAt,
      });

      if (outcome.extracted?.discount) row.discountFound += 1;
      if (outcome.extracted?.conditions) row.conditionsFound += 1;

      switch (outcome.validity?.verdict) {
        case 'usable':
          row.usable += 1;
          break;
        case 'spam':
          row.spam += 1;
          break;
        case 'expired':
          row.expired += 1;
          break;
        default:
          row.extractionFailed += 1;
      }

      rows.set(domain, row);
    }

    report([...rows.values()], ids.length);
  } finally {
    await ctx.close();
  }
}

function report(rows: Row[], total: number): void {
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  rows.sort((a, b) => b.total - a.total);

  console.log(
    pad('발신자 도메인', 30) +
      pad('건수', 6) +
      pad('발송', 6) +
      pad('보류', 6) +
      pad('만료', 6) +
      pad('스팸', 6) +
      pad('할인○', 7) +
      pad('조건○', 7),
  );
  console.log('-'.repeat(74));
  for (const r of rows) {
    console.log(
      pad(r.domain, 30) +
        pad(r.total, 6) +
        pad(r.usable, 6) +
        pad(r.extractionFailed, 6) +
        pad(r.expired, 6) +
        pad(r.spam, 6) +
        pad(r.discountFound, 7) +
        pad(r.conditionsFound, 7),
    );
  }

  const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);
  const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '-');

  console.log('-'.repeat(74));
  console.log(`전체 ${total}건`);
  console.log(`  발송 대상   ${sum((r) => r.usable)} (${pct(sum((r) => r.usable))})`);
  console.log(`  보류(파싱실패) ${sum((r) => r.extractionFailed)} (${pct(sum((r) => r.extractionFailed))})`);
  console.log(`  만료됨      ${sum((r) => r.expired)} (${pct(sum((r) => r.expired))})`);
  console.log(`  스팸        ${sum((r) => r.spam)} (${pct(sum((r) => r.spam))})`);
  console.log(`  할인 추출   ${sum((r) => r.discountFound)} (${pct(sum((r) => r.discountFound))})`);
}

main().catch((e: unknown) => {
  console.error('실패:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
