import { GmailWatchRenewalJob, RENEW_WITHIN_DAYS } from './gmail-watch-renewal.job';
import { ReauthRequiredError } from '../auth/mail-provider.interface';

const NOW = new Date('2026-09-30T00:00:00Z');
const days = (n: number): string =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

const build = (
  accounts: { id: string; cursor: unknown; consecutiveFailures?: number }[],
  overrides: { registerWatch?: jest.Mock; loadActive?: jest.Mock } = {},
) => {
  const savedWatches: string[] = [];
  const reauth: string[] = [];
  const failureUpdates: number[] = [];

  const prisma = {
    mailAccount: {
      findMany: jest.fn(async () =>
        accounts.map((a) => ({ consecutiveFailures: 0, ...a })),
      ),
      update: jest.fn(async ({ data }: never) => {
        const d = data as { consecutiveFailures?: number };
        if (d.consecutiveFailures !== undefined) {
          failureUpdates.push(d.consecutiveFailures);
        }
        return {};
      }),
    },
  };

  const tokens = {
    loadActive:
      overrides.loadActive ??
      jest.fn(async (id: string) => ({ id, token: { accessToken: 'at' } })),
    saveWatch: jest.fn(async (id: string) => {
      savedWatches.push(id);
    }),
    markReauthRequired: jest.fn(async (id: string) => {
      reauth.push(id);
    }),
  };

  const gmail = {
    registerWatch:
      overrides.registerWatch ??
      jest.fn(async () => ({
        historyId: '9999',
        expiresAt: new Date(NOW.getTime() + 7 * 86_400_000),
      })),
  };

  const job = new GmailWatchRenewalJob(
    prisma as never,
    tokens as never,
    gmail as never,
  );

  return { job, savedWatches, reauth, failureUpdates, gmail };
};

describe('GmailWatchRenewalJob', () => {
  it('만료가 임박한 계정만 재구독한다', async () => {
    const { job, savedWatches } = build([
      { id: 'soon', cursor: { watchExpiresAt: days(RENEW_WITHIN_DAYS - 1) } },
      { id: 'later', cursor: { watchExpiresAt: days(RENEW_WITHIN_DAYS + 2) } },
    ]);

    const result = await job.run(NOW);

    expect(savedWatches).toEqual(['soon']);
    expect(result).toMatchObject({ checked: 1, renewed: 1 });
  });

  it('만료 시각을 모르는 계정은 재구독 대상으로 본다', async () => {
    const { job, savedWatches } = build([{ id: 'unknown', cursor: {} }]);

    await job.run(NOW);

    expect(savedWatches).toEqual(['unknown']);
  });

  it('이미 만료된 계정도 재구독한다', async () => {
    const { job, savedWatches } = build([
      { id: 'expired', cursor: { watchExpiresAt: days(-1) } },
    ]);

    await job.run(NOW);

    expect(savedWatches).toEqual(['expired']);
  });

  it('토큰이 폐기된 계정은 재인증 필요로 돌린다', async () => {
    const { job, reauth } = build(
      [{ id: 'revoked', cursor: {} }],
      {
        registerWatch: jest.fn(async () => {
          throw new ReauthRequiredError('invalid_grant');
        }),
      },
    );

    const result = await job.run(NOW);

    expect(reauth).toEqual(['revoked']);
    expect(result.reauthRequired).toBe(1);
  });

  it('일시적 실패는 바로 포기하지 않고 실패 횟수만 올린다', async () => {
    const { job, reauth, failureUpdates } = build(
      [{ id: 'flaky', cursor: {}, consecutiveFailures: 0 }],
      { registerWatch: jest.fn(async () => { throw new Error('503'); }) },
    );

    const result = await job.run(NOW);

    expect(result.failed).toBe(1);
    expect(failureUpdates).toEqual([1]);
    expect(reauth).toEqual([]);
  });

  it('연속 실패가 한계를 넘으면 재인증 필요로 돌린다', async () => {
    const { job, reauth } = build(
      [{ id: 'broken', cursor: {}, consecutiveFailures: 2 }],
      { registerWatch: jest.fn(async () => { throw new Error('503'); }) },
    );

    const result = await job.run(NOW);

    expect(reauth).toEqual(['broken']);
    expect(result.reauthRequired).toBe(1);
  });

  it('계정이 비활성이면 재인증 필요로 집계한다', async () => {
    const { job, gmail } = build([{ id: 'inactive', cursor: {} }], {
      loadActive: jest.fn(async () => null),
    });

    const result = await job.run(NOW);

    expect(result.reauthRequired).toBe(1);
    expect(gmail.registerWatch).not.toHaveBeenCalled();
  });
});
