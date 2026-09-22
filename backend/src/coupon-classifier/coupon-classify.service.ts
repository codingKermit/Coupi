import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CouponClassifierService } from './coupon-classifier.service';
import { CloudTasksEnqueuer } from '../common/messaging/cloud-tasks.enqueuer';
import { GmailProvider } from '../auth/gmail.provider';
import { MailAccountTokenService } from '../auth/mail-account-token.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { toPlainText } from '../auth/gmail-message.util';
import { expiryReminderTime } from './expiry-reminder.util';
import type {
  CouponClassifyMessage,
  ExpiryReminderTask,
  PushDispatchTask,
} from '../common/types/messages';

export const PUSH_DISPATCH_PATH = '/internal/push-dispatch';
export const EXPIRY_REMINDER_PATH = '/internal/expiry-reminder';

export interface ClassifyOutcome {
  verdict: 'notified' | 'held' | 'discarded' | 'skipped';
  reason?: string;
  couponId?: string;
  reminderScheduled?: boolean;
}

/**
 * `coupon-classify` 토픽 핸들러 (`docs/05-백엔드아키텍처.md`).
 *
 * 수집 단계가 기록한 `processed_mails` 한 건을 받아 본문을 조회하고 판별한 뒤,
 * 사용 가능한 쿠폰이면 `coupons` 레코드를 만들고 푸시 발송을 적재한다
 * (`docs/04-푸시알림.md` "발송 흐름").
 *
 * 규칙 필터는 수집 단계에서 이미 통과했으므로 다시 돌리지 않는다.
 *
 * Pub/Sub은 at-least-once이므로 멱등해야 한다. 같은 `processedMailId`로 두 번 들어오면
 * 이미 만들어둔 쿠폰을 감지해 중복 발송하지 않는다.
 */
@Injectable()
export class CouponClassifyService {
  private readonly logger = new Logger(CouponClassifyService.name);
  private readonly pushQueue: string;
  private readonly reminderQueue: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: MailAccountTokenService,
    private readonly gmail: GmailProvider,
    private readonly classifier: CouponClassifierService,
    private readonly tasks: CloudTasksEnqueuer,
    config: ConfigService,
  ) {
    this.pushQueue = config.getOrThrow<string>(
      'CLOUD_TASKS_QUEUE_PUSH_DISPATCH',
    );
    this.reminderQueue = config.getOrThrow<string>(
      'CLOUD_TASKS_QUEUE_EXPIRY_REMINDER',
    );
  }

  async handle(
    message: CouponClassifyMessage,
    now: Date = new Date(),
  ): Promise<ClassifyOutcome> {
    const mail = await this.prisma.processedMail.findUnique({
      where: { id: message.processedMailId },
      include: { mailAccount: { select: { id: true, userId: true } } },
    });

    if (!mail) {
      // 계정 연결 해제로 CASCADE 삭제된 경우. 재전송받아도 결과가 같으므로 ack한다.
      return { verdict: 'skipped', reason: 'processed_mail_없음' };
    }

    // 이미 판별해 쿠폰을 만든 메일이면 다시 처리하지 않는다 (at-least-once 대응).
    const existing = await this.prisma.coupon.findFirst({
      where: { processedMailId: mail.id },
      select: { id: true },
    });

    if (existing) {
      return { verdict: 'skipped', reason: '이미 처리됨', couponId: existing.id };
    }

    // 연결 해제·재인증 대기 계정은 건너뛴다 (docs/08 "데이터 정합성").
    const account = await this.tokens.loadActive(mail.mailAccount.id);
    if (!account) {
      return { verdict: 'skipped', reason: '계정 비활성' };
    }

    const body = await this.gmail.fetchMessageBody(
      account.token,
      mail.providerMessageId,
    );

    const outcome = this.classifier.extractAndJudge(
      {
        sender: mail.sender,
        subject: mail.subject ?? '',
        bodyText: toPlainText(body),
        receivedAt: mail.receivedAt,
      },
      now,
    );

    await this.prisma.processedMail.update({
      where: { id: mail.id },
      data: { filterResult: outcome.filterResult },
    });

    if (!outcome.shouldNotify || !outcome.extracted || !outcome.extractorType) {
      // 보류(만료일 파싱 실패)와 폐기(스팸·만료)를 구분해 기록한다.
      // 보류 비율이 곧 파서 보강 우선순위의 근거다 (docs/02).
      return {
        verdict:
          outcome.filterResult === 'extraction_failed' ? 'held' : 'discarded',
        reason: outcome.validity?.verdict,
      };
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        processedMailId: mail.id,
        userId: mail.mailAccount.userId,
        discount: outcome.extracted.discount,
        expiryDate: outcome.extracted.expiryDate
          ? new Date(outcome.extracted.expiryDate)
          : null,
        conditions: outcome.extracted.conditions,
        extractorId: outcome.extracted.extractorId,
        extractorType: outcome.extractorType,
        usableNow: true,
        status: 'active',
      },
      select: { id: true },
    });

    const pushTask: PushDispatchTask = {
      couponId: coupon.id,
      notificationType: 'new_coupon',
    };
    await this.tasks.enqueue(this.pushQueue, PUSH_DISPATCH_PATH, pushTask);

    const reminderScheduled = await this.scheduleReminder(
      coupon.id,
      outcome.extracted.expiryDate,
      now,
    );

    return { verdict: 'notified', couponId: coupon.id, reminderScheduled };
  }

  /**
   * 만료 임박 리마인더를 쿠폰 생성 시점에 미리 예약한다.
   * 매일 전체 쿠폰을 훑는 배치가 필요 없어진다 (`docs/05` "BullMQ 대비 달라지는 점").
   */
  private async scheduleReminder(
    couponId: string,
    expiryDate: string | null,
    now: Date,
  ): Promise<boolean> {
    const at = expiryReminderTime(expiryDate, now);
    if (!at) return false;

    const task: ExpiryReminderTask = { couponId };
    await this.tasks.enqueue(
      this.reminderQueue,
      EXPIRY_REMINDER_PATH,
      task,
      at,
    );

    return true;
  }
}
