import { DevicesService } from './devices.service';

const USER = 'user-1';

const build = (existing?: { userId: string } | null) => {
  const upserts: unknown[] = [];
  const deleted: string[] = [];

  const prisma = {
    device: {
      upsert: jest.fn(async (args: never) => {
        upserts.push(args);
        return { id: 'dev-1' };
      }),
      findUnique: jest.fn(async () => existing ?? null),
      delete: jest.fn(async ({ where }: never) => {
        deleted.push((where as { id: string }).id);
        return {};
      }),
    },
  };

  return { service: new DevicesService(prisma as never), upserts, deleted };
};

describe('DevicesService — 등록', () => {
  it('같은 토큰을 다시 등록하면 갱신한다 (onTokenRefresh 대응)', async () => {
    const { service, upserts } = build();

    const id = await service.register(USER, 'token-1', 'ios');

    expect(id).toBe('dev-1');
    expect(upserts[0]).toMatchObject({
      where: { userId_fcmToken: { userId: USER, fcmToken: 'token-1' } },
      create: { userId: USER, fcmToken: 'token-1', platform: 'ios' },
    });
  });

  it('갱신 시 lastActiveAt을 올린다', async () => {
    const { service, upserts } = build();
    await service.register(USER, 'token-1', 'android');

    const args = upserts[0] as { update: { lastActiveAt: Date } };
    expect(args.update.lastActiveAt).toBeInstanceOf(Date);
  });
});

describe('DevicesService — 해제', () => {
  it('본인 디바이스는 삭제한다', async () => {
    const { service, deleted } = build({ userId: USER });

    expect(await service.unregister(USER, 'dev-1')).toBe('ok');
    expect(deleted).toEqual(['dev-1']);
  });

  it('없는 디바이스는 not_found', async () => {
    const { service, deleted } = build(null);

    expect(await service.unregister(USER, 'dev-1')).toBe('not_found');
    expect(deleted).toEqual([]);
  });

  it('남의 디바이스는 지우지 않는다', async () => {
    const { service, deleted } = build({ userId: 'someone-else' });

    expect(await service.unregister(USER, 'dev-1')).toBe('forbidden');
    expect(deleted).toEqual([]);
  });
});
