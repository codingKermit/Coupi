import type { gmail_v1 } from 'googleapis';

import type { MailBody, RawMailMessage } from './mail-provider.interface';

/**
 * 본문 텍스트 상한. 이보다 긴 본문은 잘라서 처리한다
 * (`docs/08-에러처리및엣지케이스.md` "매우 큰 첨부파일이 포함된 메일").
 */
export const MAX_BODY_TEXT_LENGTH = 4000;

/** Gmail은 본문을 base64url로 인코딩해 준다. */
export function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

export function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | null {
  const target = name.toLowerCase();
  const found = headers?.find((h) => h.name?.toLowerCase() === target);
  return found?.value ?? null;
}

/**
 * MIME 파트 트리를 훑어 text/plain과 text/html을 모은다.
 *
 * 첨부파일은 건드리지 않는다 — `filename`이 있는 파트는 건너뛴다. 본문만 필요하고,
 * 첨부를 받으면 메모리와 Gmail API 할당량을 불필요하게 쓴다 (`docs/08`).
 */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): MailBody {
  const body: MailBody = {};

  const walk = (part: gmail_v1.Schema$MessagePart | undefined): void => {
    if (!part) return;

    // 첨부파일 파트는 무시한다.
    if (part.filename) return;

    const data = part.body?.data;
    if (data) {
      if (part.mimeType === 'text/plain' && !body.text) {
        body.text = decodeBase64Url(data);
      } else if (part.mimeType === 'text/html' && !body.html) {
        body.html = decodeBase64Url(data);
      }
    }

    for (const child of part.parts ?? []) walk(child);
  };

  walk(payload);
  return body;
}

/**
 * HTML 본문을 판별용 평문으로 바꾼다.
 *
 * 정교한 렌더링이 목적이 아니라 정규식이 훑을 텍스트를 만드는 게 목적이다.
 * script/style 내용은 버리고, 태그를 공백으로 바꾼 뒤 엔티티 몇 가지만 되돌린다.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    // 태그를 공백으로 바꾸는 과정에서 줄바꿈 옆에 공백이 붙는다. 여기서 걷어낸다.
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * 판별 파이프라인에 넘길 본문 텍스트를 만든다.
 * text/plain을 우선하고, 없으면 HTML을 평문화한다.
 */
export function toPlainText(body: MailBody): string {
  const text = body.text ?? (body.html ? htmlToText(body.html) : '');
  return text.length > MAX_BODY_TEXT_LENGTH
    ? text.slice(0, MAX_BODY_TEXT_LENGTH)
    : text;
}

/** Gmail 메시지에서 수집 파이프라인이 쓰는 메타데이터만 뽑는다. */
export function toRawMailMessage(
  message: gmail_v1.Schema$Message,
): RawMailMessage | null {
  const id = message.id;
  if (!id) return null;

  const headers = message.payload?.headers ?? undefined;

  // internalDate(ms 문자열)가 가장 신뢰할 수 있다. 없으면 Date 헤더로 폴백한다.
  const dateHeader = getHeader(headers, 'Date');
  const receivedAt = message.internalDate
    ? new Date(Number(message.internalDate))
    : dateHeader
      ? new Date(dateHeader)
      : null;

  if (!receivedAt || Number.isNaN(receivedAt.getTime())) return null;

  return {
    providerMessageId: id,
    from: getHeader(headers, 'From') ?? '',
    subject: getHeader(headers, 'Subject') ?? '',
    receivedAt,
  };
}
