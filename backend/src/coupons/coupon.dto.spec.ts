import { toCouponDto } from './coupon.dto';

describe('toCouponDto', () => {
  const row = {
    id: 'c-1',
    discount: '15%',
    expiryDate: new Date('2026-10-15T00:00:00Z'),
    conditions: '30,000원 이상 구매 시',
    status: 'active',
    createdAt: new Date('2026-09-30T00:00:00Z'),
    processedMail: {
      sender: '쿠팡 <no-reply@coupang.com>',
      providerMessageId: 'gmail-abc',
    },
  };

  it('발신자에서 브랜드명을 뽑는다', () => {
    expect(toCouponDto(row).brandName).toBe('쿠팡');
  });

  it('만료일을 ISO 날짜 문자열로 내린다', () => {
    expect(toCouponDto(row).expiryDate).toBe('2026-10-15');
  });

  it('만료일이 없으면 null', () => {
    expect(toCouponDto({ ...row, expiryDate: null }).expiryDate).toBeNull();
  });

  it('원본 메일 링크를 만든다 (본문을 저장하지 않으므로)', () => {
    expect(toCouponDto(row).sourceMailUrl).toContain('gmail-abc');
  });

  it('status가 비어 있으면 active로 본다', () => {
    expect(toCouponDto({ ...row, status: null }).status).toBe('active');
  });
});
