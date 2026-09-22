-- Prisma 스키마로 표현할 수 없는 제약/인덱스.
-- 최초 마이그레이션 SQL 끝에 붙여넣어 커밋한다 (prisma/README.md 참고).
-- 기준: docs/03-API-DB-스펙.md, docs/02-쿠폰판별로직.md

-- gen_random_uuid() 사용을 위한 확장
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CHECK 제약
ALTER TABLE "mail_accounts"
  ADD CONSTRAINT "mail_accounts_provider_check" CHECK ("provider" IN ('gmail'));
ALTER TABLE "mail_accounts"
  ADD CONSTRAINT "mail_accounts_status_check"
  CHECK ("status" IN ('active', 'reauth_required', 'auth_failed', 'revoked'));

ALTER TABLE "processed_mails"
  ADD CONSTRAINT "processed_mails_filter_result_check"
  CHECK ("filter_result" IN ('passed', 'filtered_out', 'extraction_failed'));

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_extractor_type_check"
  CHECK ("extractor_type" IN ('sender_specific', 'generic_regex', 'llm'));
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_status_check"
  CHECK ("status" IN ('active', 'expired', 'used', 'dismissed'));

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_platform_check" CHECK ("platform" IN ('ios', 'android'));

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_type_check"
  CHECK ("notification_type" IN ('new_coupon', 'expiry_reminder'));
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_send_status_check"
  CHECK ("send_status" IN ('pending', 'sent', 'failed', 'skipped_disabled'));

-- 부분 인덱스 (Prisma 스키마에 WHERE 절을 쓸 수 없음)
CREATE INDEX "idx_mail_accounts_status" ON "mail_accounts" ("status") WHERE "status" != 'active';
CREATE INDEX "idx_notifications_status" ON "notifications" ("send_status") WHERE "send_status" = 'pending';
