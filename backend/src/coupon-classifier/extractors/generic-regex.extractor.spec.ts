import { GenericRegexExtractor } from './generic-regex.extractor';

describe('GenericRegexExtractor', () => {
  const extractor = new GenericRegexExtractor();
  const receivedAt = new Date('2026-09-22T09:00:00+09:00');
  const ctx = { receivedAt };

  it('할인율, 만료일, 조건을 함께 뽑는다', () => {
    const result = extractor.extract(
      '[쿠팡] 15% 할인 쿠폰이 도착했어요',
      '30,000원 이상 구매 시 사용 가능합니다. 10/15까지 사용하세요.',
      ctx,
    );

    expect(result).toEqual({
      discount: '15%',
      expiryDate: '2026-10-15',
      conditions: '30,000원 이상 구매 시',
      isSpammy: false,
      extractorId: 'generic_v1',
    });
  });

  it('원 단위 할인도 인식한다', () => {
    const result = extractor.extract('5,000원 할인', '2026-10-01까지', ctx);
    expect(result.discount).toBe('5,000원');
  });

  it('영문 OFF 표기를 인식한다', () => {
    const result = extractor.extract('20% OFF', '~ 10/15', ctx);
    expect(result.discount).toBe('20%');
  });

  it('제목에만 정보가 있어도 뽑는다 (본문이 이미지인 메일 대응)', () => {
    const result = extractor.extract('30% 할인 ~ 10/31', '', ctx);
    expect(result.discount).toBe('30%');
    expect(result.expiryDate).toBe('2026-10-31');
  });

  it('만료일을 못 찾으면 null을 남긴다 (보류 대상)', () => {
    const result = extractor.extract('10% 할인 쿠폰', '지금 확인하세요', ctx);
    expect(result.discount).toBe('10%');
    expect(result.expiryDate).toBeNull();
  });

  it('한정 조건을 인식한다', () => {
    const result = extractor.extract('첫구매 한정 쿠폰', '10/15까지', ctx);
    expect(result.conditions).toBe('첫구매 한정');
  });

  describe('스팸 판정', () => {
    it('설문조사는 할인 정보가 있어도 스팸으로 본다', () => {
      const result = extractor.extract(
        '설문조사 참여하고 10% 할인 받으세요',
        '10/15까지',
        ctx,
      );
      expect(result.isSpammy).toBe(true);
    });

    it('"마지막 기회"는 할인 정보가 없을 때만 스팸으로 본다', () => {
      const spam = extractor.extract('마지막 기회!', '지금 확인', ctx);
      expect(spam.isSpammy).toBe(true);

      const legit = extractor.extract(
        '마지막 기회! 20% 할인',
        '10/15까지',
        ctx,
      );
      expect(legit.isSpammy).toBe(false);
    });

    it('회원가입 유도는 스팸으로 본다', () => {
      const result = extractor.extract(
        '회원가입만 해도 적립금 지급',
        '10/15까지',
        ctx,
      );
      expect(result.isSpammy).toBe(true);
    });
  });

  it('모든 발신자를 처리할 수 있다 (폴백 파서)', () => {
    expect(extractor.canHandle()).toBe(true);
  });

  it('context가 없으면 현재 시각을 기준으로 삼는다', () => {
    const result = extractor.extract('10% 할인', '유효기간 없음');
    expect(result.extractorId).toBe('generic_v1');
  });
});
