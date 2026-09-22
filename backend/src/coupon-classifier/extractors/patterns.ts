/**
 * 범용 추출 패턴. 기준은 `docs/02-쿠폰판별로직.md` "범용 정규식 파서" 표.
 * 발신자 전용 파서도 공통 패턴이 필요하면 여기서 가져다 쓴다.
 */

/** 할인율/금액 — 먼저 매칭되는 것을 채택한다 */
export const DISCOUNT_PATTERNS: { pattern: RegExp; format: (m: RegExpMatchArray) => string }[] = [
  {
    pattern: /(\d{1,3})\s*%\s*(?:할인|OFF|off|Off)/,
    format: (m) => `${m[1]}%`,
  },
  {
    pattern: /([\d,]+)\s*원\s*할인/,
    format: (m) => `${m[1]}원`,
  },
  {
    pattern: /([\d,]+)\s*원\s*쿠폰/,
    format: (m) => `${m[1]}원`,
  },
];

/** 사용 조건 */
export const CONDITION_PATTERNS: { pattern: RegExp; format: (m: RegExpMatchArray) => string }[] = [
  {
    pattern: /([\d,]+\s*원)\s*이상\s*(구매|결제)\s*시/,
    format: (m) => `${m[1].replace(/\s+/g, '')} 이상 ${m[2]} 시`,
  },
  {
    pattern: /([\w가-힣]+)\s*한정/,
    format: (m) => `${m[1]} 한정`,
  },
];

/**
 * 스팸성 문구 블랙리스트.
 *
 * `standalone: true`인 항목은 "할인 정보 없이 단독으로 등장할 때만" 스팸으로 본다
 * (docs/02). 실제 할인 쿠폰 메일도 마케팅 문구로 "마지막 기회"를 쓰기 때문이다.
 */
export const SPAM_PATTERNS: { pattern: RegExp; standalone: boolean }[] = [
  { pattern: /설문\s*조사/, standalone: false },
  { pattern: /무료\s*체험\s*신청/, standalone: false },
  { pattern: /회원\s*가입만\s*해도/, standalone: false },
  { pattern: /지금\s*안\s*사면/, standalone: true },
  { pattern: /마지막\s*기회/, standalone: true },
];
