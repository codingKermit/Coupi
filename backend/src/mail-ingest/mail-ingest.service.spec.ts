import { ConfigService } from '@nestjs/config';

import { MailIngestService } from './mail-ingest.service';
import { HistoryExpiredError, ReauthRequiredError } from './mail-ingest.types';
import type { MailAccountWithToken, RawMailMessage } from './mail-ingest.types';

const ACCOUNT_ID = 'acc-1';
const USER_ID = 'user-1';

const message = (id: string, from = 'no-reply@coupang.com'): RawMailMessage => ({
  providerMessageId: id,
  from,
  subject: '쿠폰 도착',
  receivedAt: new Date('2026-09-22T09:00:00+09:00'),
});

const account: MailAccountWithToken = {
  id: ACCOUNT_ID,
  userId: USER_ID,
  providerAccountEmail: 'user@gmail.com',
  cursor: { historyId: '1000' },
  token: {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: new Date(Date.now() + 3600_000),
    scope: [],
  },
};

const build = (overrides: {
  account?: MailAccountWithToken | null;
  fetchNew?: jest.Mock;
  fetchSince?: jest.Mock;
  existingIds?: string[];
  filterPasses?: boolean;
}) => {
  const existing = new Set(overrides.existingIds ?? []);
  const created: string[] = [];
  const published: unknown[] = [];
  const savedCursors: string[] = [];
  const reauthCalls: string[] = [];

  const prisma = {
    processedMail: {
      findUnique: jest.fn(async ({ where }: never) => {
        const id = (where as { mailAccountId_providerMessageId: { providerMessageId: string } })
          .mailAccountId_providerMessageId.providerMessageId;
        return existing.has(id) ? { id: `pm-${id}` } : null;
      }),
      create: jest.fn(async ({ data }: never) => {
        const id = (data as { providerMessageId: string }).providerMessageId;
        created.push(id);
        existing.add(id);
        return { id: `pm-${id}` };
      }),
    },
  };

  const tokens = {
    loadActive: jest.fn(async () =>
      overrides.account === undefined ? account : overrides.account,
    ),
    markReauthRequired: jest.fn(async (id: string) => {
      reauthCalls.push(id);
    }),
    saveCursor: jest.fn(async (_id: string, historyId: string) => {
      savedCursors.push(historyId);
    }),
  };

  const gmail = {
    fetchNewMessages:
      overrides.fetchNew ??
      jest.fn(async () => ({ messages: [], nextCursor: { historyId: '2000' } })),
    fetchMessagesSince:
      overrides.fetchSince ??
      jest.fn(async () => ({ messages: [], nextCursor: { historyId: '3000' } })),
  };

  const ruleFilter = {
    apply: jest.fn(async () => ({
      passed: overrides.filterPasses ?? true,
      reason: 'domain_whitelist' as const,
    })),
  };

  const publisher = {
    publish: jest.fn(async (_topic: string, payload: unknown) => {
      published.push(payload);
      return 'mid';
    }),
  };

  const config = {
    getOrThrow: () => 'coupon-classify',
  } as unknown as ConfigService;

  const service = new MailIngestService(
    prisma as never,
    tokens as never,
    gmail as never,
    ruleFilter as never,
    publisher as never,
    config,
  );

  return { service, created, published, savedCursors, reauthCalls, gmail, ruleFilter };
};

describe('MailIngestService', () => {
  const msg = { mailAccountId: ACCOUNT_ID, triggeredBy: 'webhook' as const };

  it('신규 메일을 기록하고 판별 큐로 넘긴다', async () => {
    const fetchNew = jest.fn(async () => ({
      messages: [message('m1'), message('m2')],
      nextCursor: { historyId: '2000' },
    }));
    const { service, created, published, savedCursors } = build({ fetchNew });

    const outcome = await service.handle(msg);

    expect(outcome).toMatchObject({ fetched: 2, passedFilter: 2, recorded: 2 });
    expect(created).toEqual(['m1', 'm2']);
    expect(published).toEqual([
      { processedMailId: 'pm-m1' },
      { processedMailId: 'pm-m2' },
    ]);
    expect(savedCursors).toEqual(['2000']);
  });

  it('이미 처리한 메일은 다시 발행하지 않는다 (at-least-once 대응)', async () => {
    const fetchNew = jest.fn(async () => ({
      messages: [message('m1'), message('m2')],
      nextCursor: { historyId: '2000' },
    }));
    const { service, created, published } = build({
      fetchNew,
      existingIds: ['m1'],
    });

    const outcome = await service.handle(msg);

    expect(outcome.recorded).toBe(1);
    expect(created).toEqual(['m2']);
    expect(published).toEqual([{ processedMailId: 'pm-m2' }]);
  });

  it('규칙 필터에서 걸린 메일은 기록하지 않는다', async () => {
    const fetchNew = jest.fn(async () => ({
      messages: [message('m1')],
      nextCursor: { historyId: '2000' },
    }));
    const { service, created, published } = build({
      fetchNew,
      filterPasses: false,
    });

    const outcome = await service.handle(msg);

    expect(outcome).toMatchObject({ fetched: 1, passedFilter: 0, recorded: 0 });
    expect(created).toEqual([]);
    expect(published).toEqual([]);
  });

  it('커서가 만료되면 최근 24시간을 재동기화한다', async () => {
    const fetchNew = jest.fn(async () => {
      throw new HistoryExpiredError('1000');
    });
    const fetchSince = jest.fn(async () => ({
      messages: [message('m9')],
      nextCursor: { historyId: '3000' },
    }));
    const { service, created, savedCursors } = build({ fetchNew, fetchSince });

    const outcome = await service.handle(msg);

    expect(outcome.resynced).toBe(true);
    expect(fetchSince).toHaveBeenCalled();
    expect(created).toEqual(['m9']);
    expect(savedCursors).toEqual(['3000']);
  });

  it('커서가 없으면 재동기화로 시작한다', async () => {
    const { service, gmail } = build({
      account: { ...account, cursor: {} },
    });

    const outcome = await service.handle(msg);

    expect(outcome.resynced).toBe(true);
    expect(gmail.fetchNewMessages).not.toHaveBeenCalled();
    expect(gmail.fetchMessagesSince).toHaveBeenCalled();
  });

  it('비활성 계정은 건너뛴다', async () => {
    const { service, gmail } = build({ account: null });

    const outcome = await service.handle(msg);

    expect(outcome.skipped).toBe('inactive');
    expect(gmail.fetchNewMessages).not.toHaveBeenCalled();
  });

  it('토큰이 폐기되면 재인증 필요로 표시하고 멈춘다', async () => {
    const fetchNew = jest.fn(async () => {
      throw new ReauthRequiredError('invalid_grant');
    });
    const { service, reauthCalls } = build({ fetchNew });

    const outcome = await service.handle(msg);

    expect(outcome.skipped).toBe('inactive');
    expect(reauthCalls).toEqual([ACCOUNT_ID]);
  });
});
