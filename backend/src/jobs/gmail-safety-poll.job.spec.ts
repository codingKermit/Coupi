import { ConfigService } from '@nestjs/config';

import { GmailSafetyPollJob } from './gmail-safety-poll.job';

const build = (accountIds: string[], failOn: string[] = []) => {
  const published: { payload: unknown; orderingKey?: string }[] = [];

  const prisma = {
    mailAccount: {
      findMany: jest.fn(async () => accountIds.map((id) => ({ id }))),
    },
  };

  const publisher = {
    publish: jest.fn(
      async (_topic: string, payload: unknown, orderingKey?: string) => {
        if (orderingKey && failOn.includes(orderingKey)) {
          throw new Error('발행 실패');
        }
        published.push({ payload, orderingKey });
        return 'mid';
      },
    ),
  };

  const config = {
    getOrThrow: () => 'mail-ingest',
  } as unknown as ConfigService;

  const job = new GmailSafetyPollJob(
    prisma as never,
    publisher as never,
    config,
  );

  return { job, published };
};

describe('GmailSafetyPollJob', () => {
  it('활성 계정 전체를 수집 큐에 넣는다', async () => {
    const { job, published } = build(['acc-1', 'acc-2']);

    const result = await job.run();

    expect(result).toEqual({ accounts: 2, enqueued: 2 });
    expect(published.map((p) => p.payload)).toEqual([
      { mailAccountId: 'acc-1', triggeredBy: 'polling' },
      { mailAccountId: 'acc-2', triggeredBy: 'polling' },
    ]);
  });

  it('ordering key로 계정 id를 써서 webhook 경로와 순서를 맞춘다', async () => {
    const { job, published } = build(['acc-1']);

    await job.run();

    expect(published[0].orderingKey).toBe('acc-1');
  });

  it('한 계정이 실패해도 나머지를 계속 처리한다', async () => {
    const { job, published } = build(['acc-1', 'acc-2', 'acc-3'], ['acc-2']);

    const result = await job.run();

    expect(result).toEqual({ accounts: 3, enqueued: 2 });
    expect(published.map((p) => p.orderingKey)).toEqual(['acc-1', 'acc-3']);
  });

  it('활성 계정이 없으면 아무것도 하지 않는다', async () => {
    const { job, published } = build([]);

    const result = await job.run();

    expect(result).toEqual({ accounts: 0, enqueued: 0 });
    expect(published).toEqual([]);
  });
});
