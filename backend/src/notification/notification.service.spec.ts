import { NotificationService } from './notification.service';
import type { SendResult } from './fcm.client';

const COUPON_ID = 'coupon-1';
const NOW = new Date('2026-09-22T09:00:00+09:00');

const baseCoupon = {
  id: COUPON_ID,
  status: 'active',
  discount: '15%',
  expiryDate: new Date('2026-09-30T00:00:00Z'),
  processedMail: { sender: '쿠팡 <no-reply@coupang.com>' },
  user: { id: 'user-1', notificationsEnabled: true },
};

const build = (overrides: {
  coupon?: Partial<typeof baseCoupon> | null;
  devices?: { id: string; fcmToken: string }[];
  alreadySent?: string[];
  sendResults?: SendResult[];
}) => {
  const notifications: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const deletedDevices: string[] = [];
  const sendCalls: string[] = [];

  const results = [...(overrides.sendResults ?? [])];

  const prisma = {
    coupon: {
      findUnique: jest.fn(async () =>
        overrides.coupon === null ? null : { ...baseCoupon, ...overrides.coupon },
      ),
    },
    device: {
      findMany: jest.fn(
        async () =>
          overrides.devices ?? [{ id: 'dev-1', fcmToken: 'token-1' }],
      ),
      delete: jest.fn(async ({ where }: never) => {
        deletedDevices.push((where as { id: string }).id);
        return {};
      }),
    },
    notification: {
      findMany: jest.fn(async () =>
        (overrides.alreadySent ?? []).map((deviceId) => ({ deviceId })),
      ),
      create: jest.fn(async ({ data }: never) => {
        notifications.push(data as Record<string, unknown>);
        return { id: `n-${notifications.length}` };
      }),
      update: jest.fn(async ({ data }: never) => {
        updates.push(data as Record<string, unknown>);
        return {};
      }),
    },
  };

  const fcm = {
    send: jest.fn(async ({ fcmToken }: { fcmToken: string }) => {
      sendCalls.push(fcmToken);
      return results.shift() ?? { ok: true };
    }),
  };

  const service = new NotificationService(prisma as never, fcm as never);

  return { service, notifications, updates, deletedDevices, sendCalls };
};

describe('NotificationService', () => {
  it('활성 디바이스 전체에 보내고 sent로 기록한다', async () => {
    const { service, sendCalls, updates } = build({
      devices: [
        { id: 'dev-1', fcmToken: 'token-1' },
        { id: 'dev-2', fcmToken: 'token-2' },
      ],
    });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(outcome).toMatchObject({ verdict: 'sent', sent: 2, failed: 0 });
    expect(sendCalls).toEqual(['token-1', 'token-2']);
    expect(updates.every((u) => u.sendStatus === 'sent')).toBe(true);
  });

  it('알림을 끈 사용자는 skipped_disabled로 기록만 한다', async () => {
    const { service, notifications, sendCalls } = build({
      coupon: { user: { id: 'user-1', notificationsEnabled: false } },
    });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(outcome).toMatchObject({ verdict: 'skipped', reason: '알림 끔' });
    expect(notifications[0]).toMatchObject({ sendStatus: 'skipped_disabled' });
    expect(sendCalls).toEqual([]);
  });

  it('이미 보낸 디바이스는 다시 보내지 않는다 (at-least-once 대응)', async () => {
    const { service, sendCalls } = build({
      devices: [
        { id: 'dev-1', fcmToken: 'token-1' },
        { id: 'dev-2', fcmToken: 'token-2' },
      ],
      alreadySent: ['dev-1'],
    });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(sendCalls).toEqual(['token-2']);
    expect(outcome.sent).toBe(1);
  });

  it('죽은 토큰은 디바이스를 삭제하고 재시도하지 않는다', async () => {
    const { service, deletedDevices } = build({
      sendResults: [
        { ok: false, permanent: true, unregistered: true, reason: 'UNREGISTERED' },
      ],
    });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(deletedDevices).toEqual(['dev-1']);
    expect(outcome).toMatchObject({ failed: 1, shouldRetry: false });
  });

  it('일시적 실패는 재시도를 요청한다', async () => {
    const { service, deletedDevices } = build({
      sendResults: [
        { ok: false, permanent: false, unregistered: false, reason: 'HTTP 503' },
      ],
    });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(outcome.shouldRetry).toBe(true);
    expect(deletedDevices).toEqual([]);
  });

  it('일부만 일시 실패해도 재시도 대상이 된다', async () => {
    const { service } = build({
      devices: [
        { id: 'dev-1', fcmToken: 'token-1' },
        { id: 'dev-2', fcmToken: 'token-2' },
      ],
      sendResults: [
        { ok: true },
        { ok: false, permanent: false, unregistered: false, reason: 'HTTP 500' },
      ],
    });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(outcome).toMatchObject({ sent: 1, failed: 1, shouldRetry: true });
  });

  it('쿠폰이 없거나 활성이 아니면 건너뛴다', async () => {
    const gone = build({ coupon: null });
    expect((await gone.service.dispatch(COUPON_ID, 'new_coupon', NOW)).verdict).toBe(
      'skipped',
    );

    const used = build({ coupon: { status: 'used' } });
    const outcome = await used.service.dispatch(COUPON_ID, 'expiry_reminder', NOW);
    expect(outcome).toMatchObject({ verdict: 'skipped' });
    expect(used.sendCalls).toEqual([]);
  });

  it('디바이스가 없으면 no_devices', async () => {
    const { service } = build({ devices: [] });

    const outcome = await service.dispatch(COUPON_ID, 'new_coupon', NOW);

    expect(outcome.verdict).toBe('no_devices');
  });
});
