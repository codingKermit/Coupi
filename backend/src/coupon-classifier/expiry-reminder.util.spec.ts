import { expiryReminderTime } from './expiry-reminder.util';

const kst = (iso: string): Date => new Date(`${iso}+09:00`);

describe('expiryReminderTime', () => {
  it('만료 전날 09:00 KST로 예약한다', () => {
    const at = expiryReminderTime('2026-10-15', kst('2026-09-22T09:00:00'));

    expect(at?.toISOString()).toBe('2026-10-14T00:00:00.000Z'); // KST 10/14 09:00
  });

  it('월 경계를 넘어가도 전날을 정확히 계산한다', () => {
    const at = expiryReminderTime('2026-11-01', kst('2026-09-22T09:00:00'));

    expect(at?.toISOString()).toBe('2026-10-31T00:00:00.000Z'); // KST 10/31 09:00
  });

  it('만료일이 없으면 예약하지 않는다', () => {
    expect(expiryReminderTime(null, kst('2026-09-22T09:00:00'))).toBeNull();
  });

  it('예약 시각이 이미 지났으면 예약하지 않는다', () => {
    // 내일 만료 → 전날 09:00은 이미 지났다. 방금 새 쿠폰 알림을 보냈으므로 생략한다.
    const at = expiryReminderTime('2026-09-23', kst('2026-09-22T15:00:00'));

    expect(at).toBeNull();
  });

  it('오늘 만료되는 쿠폰은 예약하지 않는다', () => {
    expect(
      expiryReminderTime('2026-09-22', kst('2026-09-22T09:00:00')),
    ).toBeNull();
  });

  it('형식이 깨진 날짜는 무시한다', () => {
    expect(expiryReminderTime('not-a-date', kst('2026-09-22T09:00:00'))).toBeNull();
  });
});
