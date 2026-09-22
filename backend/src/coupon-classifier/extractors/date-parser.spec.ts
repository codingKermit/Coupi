import { parseExpiryDate } from './date-parser';

const received = (iso: string): Date => new Date(`${iso}T09:00:00+09:00`);

describe('parseExpiryDate — 절대 날짜', () => {
  const base = received('2026-09-22');

  it.each([
    ['2026-12-25까지 사용 가능', '2026-12-25'],
    ['유효기간 2026.12.25', '2026-12-25'],
    ['2026/12/25 까지', '2026-12-25'],
    ['2026년 12월 25일까지', '2026-12-25'],
  ])('%s → %s', (text, expected) => {
    expect(parseExpiryDate(text, base)).toBe(expected);
  });

  it('한 자리 월/일도 0을 채워 반환한다', () => {
    expect(parseExpiryDate('2026-10-5까지', base)).toBe('2026-10-05');
  });
});

describe('parseExpiryDate — 연도 없는 날짜', () => {
  it('같은 해로 추론한다', () => {
    expect(parseExpiryDate('12/25까지', received('2026-09-22'))).toBe(
      '2026-12-25',
    );
  });

  it('수신일보다 과거면 다음 해로 넘긴다', () => {
    // 12월에 받은 "1/5까지"는 내년 1월 5일이다.
    expect(parseExpiryDate('1/5까지', received('2026-12-20'))).toBe(
      '2027-01-05',
    );
  });

  it('물결 표기도 인식한다', () => {
    expect(parseExpiryDate('~ 12/25', received('2026-09-22'))).toBe(
      '2026-12-25',
    );
  });

  it('한국어 월일 표기를 인식한다', () => {
    expect(parseExpiryDate('12월 25일까지', received('2026-09-22'))).toBe(
      '2026-12-25',
    );
  });
});

describe('parseExpiryDate — 오파싱 방어 (docs/08)', () => {
  const base = received('2026-09-22');

  it('1년을 넘어가는 날짜는 거부한다', () => {
    expect(parseExpiryDate('2030-01-01까지', base)).toBeNull();
  });

  it('수신일보다 크게 이전인 날짜는 거부한다', () => {
    expect(parseExpiryDate('2020-01-01', base)).toBeNull();
  });

  it('존재하지 않는 날짜는 거부한다', () => {
    expect(parseExpiryDate('2026-02-30까지', base)).toBeNull();
  });

  it('날짜가 없으면 null', () => {
    expect(parseExpiryDate('지금 바로 확인하세요', base)).toBeNull();
  });

  it('주문번호 같은 숫자를 날짜로 오인하지 않는다', () => {
    expect(parseExpiryDate('주문번호 1234567890', base)).toBeNull();
  });
});
