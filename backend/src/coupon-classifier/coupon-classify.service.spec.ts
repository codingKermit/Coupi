import { ConfigService } from '@nestjs/config';

import { CouponClassifyService } from './coupon-classify.service';
import type { ExtractOutcome } from './coupon-classifier.service';

const MAIL_ID = 'pm-1';
const NOW = new Date('2026-09-22T09:00:00+09:00');

const processedMail = {
  id: MAIL_ID,
  providerMessageId: 'gmail-1',
  sender: '쿠팡 <no-reply@coupang.com>',
  subject: '15% 할인 쿠폰',
  receivedAt: NOW,
  mailAccount: { id: 'acc-1', userId: 'user-1' },
};

const usableOutcome: ExtractOutcome = {
  filterResult: 'passed',
  extracted: {
    discount: '15%',
    expiryDate: '2026-10-15',
    conditions: null,
    isSpammy: false,
    extractorId: 'generic_v1',
  },
  extractorType: 'generic_regex',
  validity: { usableNow: true, verdict: 'usable' },
  shouldNotify: true,
};

const build = (overrides: {
  mail?: typeof processedMail | null;
  existingCoupon?: { id: string } | null;
  accountActive?: boolean;
  outcome?: ExtractOutcome;
}) => {
  const enqueued: { queue: string; path: string; at?: Date }[] = [];
  const updates: string[] = [];
  const created: Record<string, unknown>[] = [];

  const prisma = {
    processedMail: {
      findUnique: jest.fn(async () =>
        overrides.mail === undefined ? processedMail : overrides.mail,
      ),
      update: jest.fn(async ({ data }: never) => {
        updates.push((data as { filterResult: string }).filterResult);
        return {};
      }),
    },
    coupon: {
      findFirst: jest.fn(async () => overrides.existingCoupon ?? null),
      create: jest.fn(async ({ data }: never) => {
        created.push(data as Record<string, unknown>);
        return { id: 'coupon-1' };
      }),
    },
  };

  const tokens = {
    loadActive: jest.fn(async () =>
      (overrides.accountActive ?? true)
        ? { id: 'acc-1', token: { accessToken: 'at' } }
        : null,
    ),
  };

  const gmail = {
    fetchMessageBody: jest.fn(async () => ({ text: '30,000원 이상 10/15까지' })),
  };

  const classifier = {
    extractAndJudge: jest.fn(() => overrides.outcome ?? usableOutcome),
  };

  const tasks = {
    enqueue: jest.fn(
      async (queue: string, path: string, _payload: unknown, at?: Date) => {
        enqueued.push({ queue, path, at });
        return 'task';
      },
    ),
  };

  const config = {
    getOrThrow: (key: string) =>
      key === 'CLOUD_TASKS_QUEUE_PUSH_DISPATCH'
        ? 'push-dispatch'
        : 'coupon-expiry-reminder',
  } as unknown as ConfigService;

  const service = new CouponClassifyService(
    prisma as never,
    tokens as never,
    gmail as never,
    classifier as never,
    tasks as never,
    config,
  );

  return { service, enqueued, updates, created, gmail, classifier };
};

const msg = { processedMailId: MAIL_ID };

describe('CouponClassifyService', () => {
  it('유효한 쿠폰이면 레코드를 만들고 푸시를 적재한다', async () => {
    const { service, enqueued, created, updates } = build({});

    const outcome = await service.handle(msg, NOW);

    expect(outcome).toMatchObject({
      verdict: 'notified',
      couponId: 'coupon-1',
      reminderScheduled: true,
    });
    expect(updates).toEqual(['passed']);
    expect(created[0]).toMatchObject({
      userId: 'user-1',
      discount: '15%',
      extractorId: 'generic_v1',
      extractorType: 'generic_regex',
      usableNow: true,
    });
    expect(enqueued.map((e) => e.queue)).toEqual([
      'push-dispatch',
      'coupon-expiry-reminder',
    ]);
    expect(enqueued[1].at).toBeInstanceOf(Date);
  });

  it('만료일 파싱에 실패하면 보류로 기록하고 발송하지 않는다', async () => {
    const { service, enqueued, updates, created } = build({
      outcome: {
        filterResult: 'extraction_failed',
        extracted: null,
        extractorType: 'generic_regex',
        validity: null,
        shouldNotify: false,
      },
    });

    const outcome = await service.handle(msg, NOW);

    expect(outcome.verdict).toBe('held');
    expect(updates).toEqual(['extraction_failed']);
    expect(created).toEqual([]);
    expect(enqueued).toEqual([]);
  });

  it('스팸이면 폐기로 기록한다', async () => {
    const { service, enqueued } = build({
      outcome: {
        filterResult: 'passed',
        extracted: { ...usableOutcome.extracted!, isSpammy: true },
        extractorType: 'generic_regex',
        validity: { usableNow: false, verdict: 'spam' },
        shouldNotify: false,
      },
    });

    const outcome = await service.handle(msg, NOW);

    expect(outcome).toMatchObject({ verdict: 'discarded', reason: 'spam' });
    expect(enqueued).toEqual([]);
  });

  it('이미 쿠폰이 있으면 중복 처리하지 않는다 (at-least-once 대응)', async () => {
    const { service, enqueued, gmail } = build({
      existingCoupon: { id: 'coupon-old' },
    });

    const outcome = await service.handle(msg, NOW);

    expect(outcome).toMatchObject({
      verdict: 'skipped',
      couponId: 'coupon-old',
    });
    expect(gmail.fetchMessageBody).not.toHaveBeenCalled();
    expect(enqueued).toEqual([]);
  });

  it('processed_mail이 사라졌으면 조용히 건너뛴다', async () => {
    const { service, gmail } = build({ mail: null });

    const outcome = await service.handle(msg, NOW);

    expect(outcome.verdict).toBe('skipped');
    expect(gmail.fetchMessageBody).not.toHaveBeenCalled();
  });

  it('계정이 비활성이면 본문을 받지 않는다', async () => {
    const { service, gmail } = build({ accountActive: false });

    const outcome = await service.handle(msg, NOW);

    expect(outcome).toMatchObject({ verdict: 'skipped', reason: '계정 비활성' });
    expect(gmail.fetchMessageBody).not.toHaveBeenCalled();
  });

  it('만료가 임박해 리마인더 시각이 지났으면 예약하지 않는다', async () => {
    const { service, enqueued } = build({
      outcome: {
        ...usableOutcome,
        extracted: { ...usableOutcome.extracted!, expiryDate: '2026-09-23' },
      },
    });

    const outcome = await service.handle(msg, NOW);

    expect(outcome.reminderScheduled).toBe(false);
    expect(enqueued.map((e) => e.queue)).toEqual(['push-dispatch']);
  });
});
