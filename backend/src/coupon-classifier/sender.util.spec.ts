import { extractSenderDomain, matchesDomain } from './sender.util';

describe('extractSenderDomain', () => {
  it('꺾쇠 형태의 From 헤더에서 도메인을 뽑는다', () => {
    expect(extractSenderDomain('쿠팡 <no-reply@coupang.com>')).toBe(
      'coupang.com',
    );
  });

  it('주소만 있는 형태도 처리한다', () => {
    expect(extractSenderDomain('no-reply@coupang.com')).toBe('coupang.com');
  });

  it('대문자를 소문자로 정규화한다', () => {
    expect(extractSenderDomain('No-Reply@COUPANG.com')).toBe('coupang.com');
  });

  it('@가 없거나 도메인이 비면 null', () => {
    expect(extractSenderDomain('그냥 이름')).toBeNull();
    expect(extractSenderDomain('user@')).toBeNull();
  });
});

describe('matchesDomain', () => {
  it('정확히 일치하면 매칭', () => {
    expect(matchesDomain('coupang.com', 'coupang.com')).toBe(true);
  });

  it('서브도메인도 매칭한다', () => {
    expect(matchesDomain('mail.coupang.com', 'coupang.com')).toBe(true);
  });

  it('접미사만 같은 다른 도메인은 매칭하지 않는다', () => {
    expect(matchesDomain('notcoupang.com', 'coupang.com')).toBe(false);
  });
});
