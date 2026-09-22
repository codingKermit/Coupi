/**
 * DB의 VARCHAR + CHECK 제약에 대응하는 애플리케이션 레벨 유니온 타입.
 * 기준 정의는 `docs/03-API-DB-스펙.md`의 DDL이다 (`prisma/README.md` "왜 enum을 쓰지 않는가" 참고).
 */

export const MAIL_PROVIDERS = ['gmail'] as const;
export type MailProviderName = (typeof MAIL_PROVIDERS)[number];

export const MAIL_ACCOUNT_STATUSES = [
  'active',
  'reauth_required',
  'auth_failed',
  'revoked',
] as const;
export type MailAccountStatus = (typeof MAIL_ACCOUNT_STATUSES)[number];

export const FILTER_RESULTS = [
  'passed',
  'filtered_out',
  'extraction_failed',
] as const;
export type FilterResult = (typeof FILTER_RESULTS)[number];

export const EXTRACTOR_TYPES = [
  'sender_specific',
  'generic_regex',
  'llm',
] as const;
export type ExtractorType = (typeof EXTRACTOR_TYPES)[number];

export const COUPON_STATUSES = [
  'active',
  'expired',
  'used',
  'dismissed',
] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const DEVICE_PLATFORMS = ['ios', 'android'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const NOTIFICATION_TYPES = ['new_coupon', 'expiry_reminder'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const SEND_STATUSES = [
  'pending',
  'sent',
  'failed',
  'skipped_disabled',
] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];
