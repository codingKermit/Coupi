import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GmailProvider } from '../auth/gmail.provider';
import { MailAccountTokenService } from '../auth/mail-account-token.service';
import {
  HistoryExpiredError,
  ReauthRequiredError,
  type FetchResult,
  type MailAccountWithToken,
  type RawMailMessage,
} from './mail-ingest.types';
import { PrismaService } from '../common/prisma/prisma.service';
import { PubSubPublisher } from '../common/messaging/pubsub.publisher';
import { RuleFilterService } from '../coupon-classifier/rule-filter.service';
import type {
  CouponClassifyMessage,
  MailIngestMessage,
} from '../common/types/messages';

/** 커서가 만료됐을 때 다시 훑을 기간 (`docs/01-메일연동.md` "신규 메일 조회"). */
const RESYNC_WINDOW_HOURS = 24;

export interface IngestOutcome {
  fetched: number;
  passedFilter: number;
  recorded: number;
  resynced: boolean;
  skipped?: 'inactive' | 'no_cursor';
}

/**
 * 메일 수집 핸들러 (`docs/01-메일연동.md`, `docs/05-백엔드아키텍처.md`).
 *
 * 흐름: 커서로 신규 메일 조회 → 규칙 필터(메타데이터) → `processed_mails` 기록 →
 * `coupon-classify` 토픽으로 전달.
 *
 * 본문은 여기서 받지 않는다. 대부분의 메일은 규칙 필터에서 걸러지므로, 통과한 메일에
 * 대해서만 판별 단계에서 본문을 받는 편이 Gmail API 할당량과 접근 최소화 원칙
 * (`docs/07-보안개인정보.md`) 양쪽에 맞다.
 *
 * Pub/Sub은 at-least-once이므로 이 핸들러는 멱등해야 한다. 중복 방어는
 * `processed_mails`의 `(mail_account_id, provider_message_id)` 유니크 제약이 맡는다.
 */
@Injectable()
export class MailIngestService {
  private readonly logger = new Logger(MailIngestService.name);
  private readonly classifyTopic: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: MailAccountTokenService,
    private readonly gmail: GmailProvider,
    private readonly ruleFilter: RuleFilterService,
    private readonly publisher: PubSubPublisher,
    config: ConfigService,
  ) {
    this.classifyTopic = config.getOrThrow<string>(
      'PUBSUB_TOPIC_COUPON_CLASSIFY',
    );
  }

  async handle(message: MailIngestMessage): Promise<IngestOutcome> {
    const account = await this.tokens.loadActive(message.mailAccountId);

    // 연결 해제됐거나 재인증이 필요한 계정은 조용히 건너뛴다 (docs/08 "데이터 정합성").
    if (!account) {
      return {
        fetched: 0,
        passedFilter: 0,
        recorded: 0,
        resynced: false,
        skipped: 'inactive',
      };
    }

    try {
      const { result, resynced } = await this.fetch(account);
      const stats = await this.record(account, result.messages);

      if (result.nextCursor.historyId) {
        await this.tokens.saveCursor(account.id, result.nextCursor.historyId);
      }

      return { ...stats, resynced };
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        await this.tokens.markReauthRequired(account.id, error.message);
        return {
          fetched: 0,
          passedFilter: 0,
          recorded: 0,
          resynced: false,
          skipped: 'inactive',
        };
      }
      throw error;
    }
  }

  /** 커서로 조회하고, 커서가 만료됐으면 최근 24시간을 다시 훑는다. */
  private async fetch(
    account: MailAccountWithToken,
  ): Promise<{ result: FetchResult; resynced: boolean }> {
    const historyId = account.cursor.historyId;

    if (!historyId) {
      // watch 등록 직후 등 커서가 아직 없는 경우도 재동기화로 처리한다.
      return { result: await this.resync(account), resynced: true };
    }

    try {
      return {
        result: await this.gmail.fetchNewMessages(account.token, { historyId }),
        resynced: false,
      };
    } catch (error) {
      if (error instanceof HistoryExpiredError) {
        this.logger.warn(
          `커서 만료 — 계정 ${account.id}, 최근 ${RESYNC_WINDOW_HOURS}시간 재동기화`,
        );
        return { result: await this.resync(account), resynced: true };
      }
      throw error;
    }
  }

  private async resync(account: MailAccountWithToken): Promise<FetchResult> {
    const since = new Date(Date.now() - RESYNC_WINDOW_HOURS * 3600_000);
    return this.gmail.fetchMessagesSince(account.token, since);
  }

  /**
   * 규칙 필터를 통과한 메일만 기록하고 판별 단계로 넘긴다.
   *
   * 걸러진 메일은 DB에 남기지 않는다 (`docs/02-쿠폰판별로직.md` 1단계).
   */
  private async record(
    account: MailAccountWithToken,
    messages: RawMailMessage[],
  ): Promise<Omit<IngestOutcome, 'resynced'>> {
    let passedFilter = 0;
    let recorded = 0;

    for (const message of messages) {
      const filtered = await this.ruleFilter.apply({
        userId: account.userId,
        sender: message.from,
        subject: message.subject,
      });

      if (!filtered.passed) continue;
      passedFilter += 1;

      const processedMailId = await this.insertProcessedMail(
        account.id,
        message,
      );

      // 이미 처리한 메일이면 다시 판별하지 않는다 (유니크 제약이 걸러낸 경우).
      if (!processedMailId) continue;
      recorded += 1;

      const payload: CouponClassifyMessage = { processedMailId };
      await this.publisher.publish(this.classifyTopic, payload);
    }

    return { fetched: messages.length, passedFilter, recorded };
  }

  /**
   * 중복이면 null을 돌려준다.
   *
   * `createMany({ skipDuplicates })`는 생성된 행의 id를 주지 않으므로, 유니크 제약 위반을
   * 정상 흐름으로 처리하는 방식을 택했다 (`docs/08` "webhook이 중복 전달됨").
   */
  private async insertProcessedMail(
    mailAccountId: string,
    message: RawMailMessage,
  ): Promise<string | null> {
    const existing = await this.prisma.processedMail.findUnique({
      where: {
        mailAccountId_providerMessageId: {
          mailAccountId,
          providerMessageId: message.providerMessageId,
        },
      },
      select: { id: true },
    });

    if (existing) return null;

    try {
      const created = await this.prisma.processedMail.create({
        data: {
          mailAccountId,
          providerMessageId: message.providerMessageId,
          sender: message.from,
          subject: message.subject.slice(0, 998),
          receivedAt: message.receivedAt,
          // 판별 단계에서 extraction_failed로 바뀔 수 있다 (docs/02).
          filterResult: 'passed',
        },
        select: { id: true },
      });

      return created.id;
    } catch (error) {
      // 같은 메시지를 동시에 처리한 경우. 중복 처리 방지가 목적이므로 정상으로 본다.
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
