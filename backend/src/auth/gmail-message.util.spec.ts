import {
  MAX_BODY_TEXT_LENGTH,
  decodeBase64Url,
  extractBody,
  getHeader,
  htmlToText,
  toPlainText,
  toRawMailMessage,
} from './gmail-message.util';

const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64url');

describe('getHeader', () => {
  const headers = [
    { name: 'From', value: '쿠팡 <no-reply@coupang.com>' },
    { name: 'Subject', value: '쿠폰 도착' },
  ];

  it('대소문자를 가리지 않고 찾는다', () => {
    expect(getHeader(headers, 'from')).toBe('쿠팡 <no-reply@coupang.com>');
    expect(getHeader(headers, 'SUBJECT')).toBe('쿠폰 도착');
  });

  it('없으면 null', () => {
    expect(getHeader(headers, 'Cc')).toBeNull();
    expect(getHeader(undefined, 'From')).toBeNull();
  });
});

describe('extractBody', () => {
  it('단일 text/plain 파트를 읽는다', () => {
    const body = extractBody({
      mimeType: 'text/plain',
      body: { data: b64('본문 텍스트') },
    });

    expect(body.text).toBe('본문 텍스트');
  });

  it('multipart 트리를 재귀로 훑는다', () => {
    const body = extractBody({
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('평문') } },
        { mimeType: 'text/html', body: { data: b64('<p>HTML</p>') } },
      ],
    });

    expect(body.text).toBe('평문');
    expect(body.html).toBe('<p>HTML</p>');
  });

  it('첨부파일 파트는 건너뛴다', () => {
    const body = extractBody({
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('본문') } },
        {
          mimeType: 'text/plain',
          filename: 'invoice.txt',
          body: { data: b64('첨부 내용') },
        },
      ],
    });

    expect(body.text).toBe('본문');
  });

  it('payload가 없으면 빈 객체', () => {
    expect(extractBody(undefined)).toEqual({});
  });
});

describe('htmlToText', () => {
  it('태그를 걷어내고 텍스트만 남긴다', () => {
    expect(htmlToText('<p>15% <b>할인</b> 쿠폰</p>')).toBe('15% 할인 쿠폰');
  });

  it('script와 style 내용을 버린다', () => {
    const html = '<style>.a{color:red}</style><p>쿠폰</p><script>x()</script>';
    expect(htmlToText(html)).toBe('쿠폰');
  });

  it('주요 엔티티를 되돌린다', () => {
    expect(htmlToText('<p>A&nbsp;&amp;&nbsp;B</p>')).toBe('A & B');
  });

  it('블록 태그를 줄바꿈으로 바꾼다', () => {
    expect(htmlToText('<p>첫줄</p><p>둘째줄</p>')).toBe('첫줄\n둘째줄');
  });
});

describe('toPlainText', () => {
  it('text/plain을 우선한다', () => {
    expect(toPlainText({ text: '평문', html: '<p>HTML</p>' })).toBe('평문');
  });

  it('text가 없으면 HTML을 평문화한다', () => {
    expect(toPlainText({ html: '<p>HTML 본문</p>' })).toBe('HTML 본문');
  });

  it('너무 긴 본문은 자른다 (docs/08)', () => {
    const long = 'a'.repeat(MAX_BODY_TEXT_LENGTH + 500);
    expect(toPlainText({ text: long })).toHaveLength(MAX_BODY_TEXT_LENGTH);
  });

  it('본문이 없으면 빈 문자열', () => {
    expect(toPlainText({})).toBe('');
  });
});

describe('toRawMailMessage', () => {
  it('internalDate를 수신 시각으로 쓴다', () => {
    const result = toRawMailMessage({
      id: 'msg-1',
      internalDate: '1758499200000',
      payload: {
        headers: [
          { name: 'From', value: 'a@b.com' },
          { name: 'Subject', value: '제목' },
        ],
      },
    });

    expect(result).toEqual({
      providerMessageId: 'msg-1',
      from: 'a@b.com',
      subject: '제목',
      receivedAt: new Date(1758499200000),
    });
  });

  it('internalDate가 없으면 Date 헤더로 폴백한다', () => {
    const result = toRawMailMessage({
      id: 'msg-2',
      payload: {
        headers: [{ name: 'Date', value: 'Mon, 22 Sep 2026 09:00:00 +0900' }],
      },
    });

    expect(result?.receivedAt.toISOString()).toBe('2026-09-22T00:00:00.000Z');
  });

  it('id가 없으면 null', () => {
    expect(toRawMailMessage({ internalDate: '1' })).toBeNull();
  });

  it('수신 시각을 알 수 없으면 null', () => {
    expect(toRawMailMessage({ id: 'x', payload: { headers: [] } })).toBeNull();
  });
});
