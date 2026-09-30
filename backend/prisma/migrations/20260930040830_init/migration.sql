-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "notifications_enabled" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'gmail',
    "provider_account_email" VARCHAR(255) NOT NULL,
    "encrypted_refresh_token" TEXT,
    "encrypted_access_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "cursor" JSONB DEFAULT '{}',
    "status" VARCHAR(20) DEFAULT 'active',
    "consecutive_failures" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_mails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mail_account_id" UUID NOT NULL,
    "provider_message_id" VARCHAR(255) NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(998),
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "filter_result" VARCHAR(20) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_mails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "processed_mail_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "discount" VARCHAR(100),
    "expiry_date" DATE,
    "conditions" TEXT,
    "extractor_id" VARCHAR(50) NOT NULL,
    "extractor_type" VARCHAR(20) NOT NULL,
    "usable_now" BOOLEAN NOT NULL,
    "status" VARCHAR(20) DEFAULT 'active',
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "fcm_token" VARCHAR(500) NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coupon_id" UUID,
    "device_id" UUID,
    "notification_type" VARCHAR(20) DEFAULT 'new_coupon',
    "send_status" VARCHAR(20) DEFAULT 'pending',
    "retry_count" SMALLINT DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_domains" (
    "id" SERIAL NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "is_global" BOOLEAN DEFAULT true,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_keywords" (
    "id" SERIAL NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "lang" VARCHAR(10) DEFAULT 'ko',
    "weight" SMALLINT DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mail_accounts_user_id_provider_provider_account_email_key" ON "mail_accounts"("user_id", "provider", "provider_account_email");

-- CreateIndex
CREATE INDEX "idx_processed_mails_account_date" ON "processed_mails"("mail_account_id", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "processed_mails_mail_account_id_provider_message_id_key" ON "processed_mails"("mail_account_id", "provider_message_id");

-- CreateIndex
CREATE INDEX "idx_coupons_user_status" ON "coupons"("user_id", "status", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_fcm_token_key" ON "devices"("user_id", "fcm_token");

-- AddForeignKey
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_mails" ADD CONSTRAINT "processed_mails_mail_account_id_fkey" FOREIGN KEY ("mail_account_id") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_processed_mail_id_fkey" FOREIGN KEY ("processed_mail_id") REFERENCES "processed_mails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_domains" ADD CONSTRAINT "filter_domains_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 아래는 prisma/sql/constraints.sql 에서 가져온 것이다.
-- Prisma 스키마로 표현할 수 없는 CHECK 제약과 부분 인덱스로,
-- 스키마를 바꿀 때마다 이 절차를 반복한다 (prisma/README.md 참고).
-- ============================================================
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
