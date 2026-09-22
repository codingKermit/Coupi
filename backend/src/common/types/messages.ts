/**
 * 내부 메시지 페이로드 계약. 기준 정의는 `docs/03-API-DB-스펙.md` "내부 메시지 스펙".
 *
 * Pub/Sub과 Cloud Tasks 모두 at-least-once 전달이므로 모든 핸들러는 멱등해야 한다
 * (`docs/08-에러처리및엣지케이스.md`).
 */

/** Pub/Sub 토픽: mail-ingest — ordering key는 mailAccountId */
export interface MailIngestMessage {
  mailAccountId: string;
  triggeredBy: 'webhook' | 'polling';
  /** webhook 경유 시에만 존재 */
  historyId?: string;
}

/** Pub/Sub 토픽: coupon-classify */
export interface CouponClassifyMessage {
  processedMailId: string;
}

/** Cloud Tasks 큐: push-dispatch */
export interface PushDispatchTask {
  couponId: string;
  notificationType: 'new_coupon' | 'expiry_reminder';
}

/** Cloud Tasks 큐: coupon-expiry-reminder — 쿠폰 생성 시점에 schedule_time으로 예약 */
export interface ExpiryReminderTask {
  couponId: string;
}

/** Pub/Sub push 구독이 전달하는 HTTP 요청 본문 형태 */
export interface PubSubPushBody {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
    orderingKey?: string;
  };
  subscription: string;
}

/** Pub/Sub push 본문의 base64 data를 디코딩해 파싱한다. */
export function decodePubSubData<T>(body: PubSubPushBody): T {
  const json = Buffer.from(body.message.data, 'base64').toString('utf8');
  return JSON.parse(json) as T;
}
