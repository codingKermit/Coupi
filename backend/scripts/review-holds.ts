/**
 * 보류(extraction_failed) 건 검토 목록 생성
 * (`docs/02-쿠폰판별로직.md` "미탐지(false negative) 프록시").
 *
 * 보류 건에는 "진짜 쿠폰인데 파서가 놓친 것"과 "애초에 쿠폰이 아닌 것"이 섞여 있다.
 * 자동 지표로는 구분할 수 없어, 사람이 열어보고 판정해야 한다. 그 판정 결과가
 * 전용 파서를 어느 발신자부터 만들지 정하는 근거다.
 *
 * 결과는 `review-holds.csv`로 저장한다 — 메일 제목이 들어가므로 **커밋하지 않는다**
 * (`docs/07-보안개인정보.md`). .gitignore에 등록되어 있다.
 *
 * 실행: npx ts-node scripts/review-holds.ts [일수]
 */

import { writeFileSync } from 'node:fs';

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
const OUT = 'review-holds.csv';

/** CSV 한 칸을 안전하게 감싼다. 제목에 쉼표·따옴표가 흔하다. */
const cell = (v: string): string => `"${v.replace(/"/g, '""')}"`;

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

    const lines = [
      [
        '판정(쿠폰이면 Y)',
        '발신자도메인',
        '제목',
        '추출된할인',
        '수신일',
        'Gmail링크',
      ]
        .map(cell)
        .join(','),
    ];

    for (const id of ids) {
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });

      const headers = data.payload?.headers ?? undefined;
      const from = getHeader(headers, 'From') ?? '';
      const subject = getHeader(headers, 'Subject') ?? '';
      const receivedAt = data.internalDate
        ? new Date(Number(data.internalDate))
        : new Date();

      const body = await provider.fetchMessageBody(loaded.token, id);
      const outcome = classifier.extractAndJudge({
        sender: from,
        subject,
        bodyText: toPlainText(body),
        receivedAt,
      });

      // 보류된 것만 사람이 볼 필요가 있다. 발송·만료·스팸은 판정이 끝난 것이다.
      if (outcome.filterResult !== 'extraction_failed') continue;

      lines.push(
        [
          '',
          extractSenderDomain(from) ?? '(알 수 없음)',
          subject,
          outcome.extracted?.discount ?? '',
          receivedAt.toISOString().slice(0, 10),
          `https://mail.google.com/mail/u/0/#all/${id}`,
        ]
          .map(cell)
          .join(','),
      );
    }

    // Excel이 UTF-8로 읽도록 BOM을 붙인다.
    writeFileSync(OUT, '﻿' + lines.join('\r\n'), 'utf8');
    console.log(`${OUT} 생성 — 보류 ${lines.length - 1}건`);
    console.log('첫 칸에 쿠폰이면 Y를 적어주세요. 링크로 원본을 열 수 있습니다.');
  } finally {
    await ctx.close();
  }
}

main().catch((e: unknown) => {
  console.error('실패:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
