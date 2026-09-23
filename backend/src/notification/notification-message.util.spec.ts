import {
  buildNotification,
  daysUntilExpiry,
  senderDisplayName,
} from './notification-message.util';

const NOW = new Date('2026-09-22T09:00:00+09:00');

describe('senderDisplayName', () => {
  it('표시 이름을 우선한다', () => {
    expect(senderDisplayName('쿠팡 <no-reply@coupang.com>')).toBe('쿠팡');
  });

  it('따옴표로 감싼 표시 이름도 처리한다', () => {
    expect(senderDisplayName('"배달의민족" <noreply@baemin.com>')).toBe(
      '배달의민족',
    );
  });

  it('표시 이름이 없으면 도메인 첫 라벨을 쓴다', () => {
    expect(senderDisplayName('<no-reply@coupang.com>')).toBe('coupang');
    expect(senderDisplayName('no-reply@coupang.com')).toBe('coupang');
  });
});

describe('daysUntilExpiry', () => {
  it('남은 일수를 KST 기준으로 센다', () => {
    expect(daysUntilExpiry('2026-09-30', NOW)).toBe(8);
    expect(daysUntilExpiry('2026-09-22', NOW)).toBe(0);
    expect(daysUntilExpiry('2026-09-21', NOW)).toBe(-1);
  });

  it('만료일이 없거나 형식이 깨지면 null', () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull();
    expect(daysUntilExpiry('nope', NOW)).toBeNull();
  });
});

describe('buildNotification — 신규 쿠폰', () => {
  it('docs/04의 예시 문구를 만든다', () => {
    const content = buildNotification(
      {
        sender: '쿠팡 <no-reply@coupang.com>',
        discount: '15%',
        expiryDate: '2026-09-30',
        notificationType: 'new_coupon',
      },
      NOW,
    );

    expect(content).toEqual({
      title: '새 쿠폰 도착',
      body: '쿠팡 15% 할인 쿠폰 · 9/30까지 사용가능',
    });
  });

  it('할인 정보가 없으면 생략한다', () => {
    const content = buildNotification(
      {
        sender: '쿠팡 <no-reply@coupang.com>',
        discount: null,
        expiryDate: '2026-09-30',
        notificationType: 'new_coupon',
      },
      NOW,
    );

    expect(content.body).toBe('쿠팡 쿠폰 · 9/30까지 사용가능');
  });
});

describe('buildNotification — 만료 임박', () => {
  it.each([
    ['2026-09-22', '오늘 자정 만료'],
    ['2026-09-23', '내일 만료'],
    ['2026-09-25', 'D-3 만료'],
  ])('만료일 %s → %s', (expiryDate, phrase) => {
    const content = buildNotification(
      {
        sender: '쿠팡 <no-reply@coupang.com>',
        discount: '15%',
        expiryDate,
        notificationType: 'expiry_reminder',
      },
      NOW,
    );

    expect(content.title).toBe('쿠폰 만료 임박');
    expect(content.body).toBe(`쿠팡 15% 할인 쿠폰 · ${phrase}`);
  });

  it('이미 지난 만료일도 오늘 자정으로 표기한다', () => {
    const content = buildNotification(
      {
        sender: '쿠팡 <no-reply@coupang.com>',
        discount: '15%',
        expiryDate: '2026-09-20',
        notificationType: 'expiry_reminder',
      },
      NOW,
    );

    expect(content.body).toContain('오늘 자정 만료');
  });
});
