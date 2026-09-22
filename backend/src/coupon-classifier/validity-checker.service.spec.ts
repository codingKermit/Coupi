import {
  ValidityCheckerService,
  toKstDateString,
} from './validity-checker.service';
import type { ExtractedCoupon } from './extractors/coupon-extractor.interface';

const coupon = (overrides: Partial<ExtractedCoupon> = {}): ExtractedCoupon => ({
  discount: '15%',
  expiryDate: '2026-10-15',
  conditions: null,
  isSpammy: false,
  extractorId: 'generic_v1',
  ...overrides,
});

describe('toKstDateString', () => {
  it('UTC 자정 직전을 KST 다음 날로 계산한다', () => {
    expect(toKstDateString(new Date('2026-09-22T15:30:00Z'))).toBe('2026-09-23');
  });
});

describe('ValidityCheckerService', () => {
  const service = new ValidityCheckerService();
  const now = new Date('2026-09-22T09:00:00+09:00');

  it('스팸이면 다른 조건을 보지 않고 폐기한다', () => {
    const result = service.check(coupon({ isSpammy: true }), now);
    expect(result).toEqual({ usableNow: false, verdict: 'spam' });
  });

  it('만료일이 없으면 보류한다', () => {
    const result = service.check(coupon({ expiryDate: null }), now);
    expect(result).toEqual({ usableNow: false, verdict: 'extraction_failed' });
  });

  it('만료일이 지났으면 폐기한다', () => {
    const result = service.check(coupon({ expiryDate: '2026-09-21' }), now);
    expect(result).toEqual({ usableNow: false, verdict: 'expired' });
  });

  it('오늘 만료되는 쿠폰은 아직 쓸 수 있다', () => {
    const result = service.check(coupon({ expiryDate: '2026-09-22' }), now);
    expect(result).toEqual({ usableNow: true, verdict: 'usable' });
  });

  it('만료 전이면 발송 대상이다', () => {
    const result = service.check(coupon({ expiryDate: '2026-10-15' }), now);
    expect(result).toEqual({ usableNow: true, verdict: 'usable' });
  });

  it('스팸 판정이 만료일 판정보다 우선한다', () => {
    const result = service.check(
      coupon({ isSpammy: true, expiryDate: null }),
      now,
    );
    expect(result.verdict).toBe('spam');
  });
});
