/**
 * 쿠폰 만료일 파싱. 기준은 `docs/02-쿠폰판별로직.md` "범용 정규식 파서"의 만료일 패턴.
 *
 * 규칙 기반이므로 "애매하면 신뢰도를 낮춘다"가 불가능하다. 확신이 없으면 null을 반환하고
 * 상위에서 보류(extraction_failed) 처리한다 — 잘못된 만료일로 알림을 보내느니 안 보내는 게 낫다.
 */

/** 파싱 결과는 항상 ISO 8601 날짜(YYYY-MM-DD) 문자열이다. */
export type IsoDate = string;

interface YearMonthDay {
  year: number;
  month: number;
  day: number;
}

/** 만료일이 메일 수신일로부터 이 일수를 넘어가면 오파싱으로 본다 (docs/08). */
export const MAX_EXPIRY_DAYS_AHEAD = 365;

/**
 * 메일 수신일보다 이만큼 이전인 날짜는 오파싱으로 본다.
 * 본문 속 다른 숫자(주문번호, 가격 등)를 날짜로 오인한 경우를 걸러내기 위한 것으로,
 * "이미 만료된 쿠폰"(수신 후 시간이 지나 만료)과는 구분된다.
 */
export const MAX_EXPIRY_DAYS_BEHIND = 1;

/** 절대 날짜: 2026-12-25, 2026.12.25, 2026/12/25 */
const ABSOLUTE_DATE = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/;

/** 한국어 절대 날짜: 2026년 12월 25일 */
const ABSOLUTE_KOREAN_DATE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;

/**
 * 연도 없는 날짜. 수신일 기준으로 연도를 추론한다.
 * - 12/25까지, 12.25까지
 * - ~ 12/25
 * - 12월 25일까지
 */
const RELATIVE_DATE_PATTERNS: RegExp[] = [
  /(\d{1,2})\s*[/.]\s*(\d{1,2})\s*(?:일)?\s*까지/,
  /~\s*(\d{1,2})\s*[/.]\s*(\d{1,2})/,
  /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*까지/,
  /~\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
];

function isValidYmd({ year, month, day }: YearMonthDay): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function toIso({ year, month, day }: YearMonthDay): IsoDate {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function daysBetween(from: YearMonthDay, to: YearMonthDay): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

function toYmd(date: Date): YearMonthDay {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/**
 * 연도가 없는 날짜의 연도를 추론한다.
 *
 * 수신일과 같은 해를 먼저 시도하고, 그 날짜가 수신일보다 과거면 다음 해로 넘긴다.
 * (12월에 받은 메일의 "1/5까지"는 내년 1월 5일이다.)
 */
function inferYear(
  month: number,
  day: number,
  receivedAt: YearMonthDay,
): YearMonthDay | null {
  for (const year of [receivedAt.year, receivedAt.year + 1]) {
    const candidate = { year, month, day };
    if (!isValidYmd(candidate)) continue;
    if (daysBetween(receivedAt, candidate) >= -MAX_EXPIRY_DAYS_BEHIND) {
      return candidate;
    }
  }
  return null;
}

/**
 * 파싱된 날짜가 상식적인 범위인지 확인한다 (docs/08 "정규식이 날짜를 잘못 파싱함").
 *
 * 수신일보다 크게 앞서거나, 1년 이상 뒤인 날짜는 본문 속 다른 숫자를 날짜로 오인한 것으로 본다.
 */
export function isPlausibleExpiry(
  candidate: YearMonthDay,
  receivedAt: YearMonthDay,
): boolean {
  const diff = daysBetween(receivedAt, candidate);
  return diff >= -MAX_EXPIRY_DAYS_BEHIND && diff <= MAX_EXPIRY_DAYS_AHEAD;
}

/**
 * 본문에서 만료일을 찾아 ISO 날짜로 반환한다. 찾지 못하거나 비상식적이면 null.
 *
 * @param text 검색 대상 (제목 + 본문을 합쳐 넘겨도 된다)
 * @param receivedAt 연도 추론과 타당성 검사의 기준 시각 (메일 수신 시각)
 */
export function parseExpiryDate(text: string, receivedAt: Date): IsoDate | null {
  const base = toYmd(receivedAt);

  // 1. 연도가 명시된 형태를 먼저 본다 — 추론이 필요 없어 가장 신뢰할 수 있다.
  for (const pattern of [ABSOLUTE_KOREAN_DATE, ABSOLUTE_DATE]) {
    const m = text.match(pattern);
    if (!m) continue;

    const candidate = {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
    };
    if (!isValidYmd(candidate)) continue;
    if (!isPlausibleExpiry(candidate, base)) continue;

    return toIso(candidate);
  }

  // 2. 연도가 없는 형태는 수신일 기준으로 연도를 추론한다.
  for (const pattern of RELATIVE_DATE_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;

    const inferred = inferYear(Number(m[1]), Number(m[2]), base);
    if (!inferred) continue;
    if (!isPlausibleExpiry(inferred, base)) continue;

    return toIso(inferred);
  }

  return null;
}
