# 03. API / DB 스펙 상세 설계 ★ 심화

> **범위 변경 (2026-09-21)**: Gmail 단독 지원으로 한정됨에 따라 네이버 관련 엔드포인트/스키마를 모두 제거했다 (`00-개요.md` 참고).

원본 설계의 "백엔드 기술 스택 및 인프라 구성"에서 언급만 되었던 데이터 모델과 API를 구체화한다.

## ERD 개요

```mermaid
erDiagram
    users ||--o{ mail_accounts : "연결"
    users ||--o{ devices : "소유"
    users ||--o{ coupons : "받음"
    mail_accounts ||--o{ processed_mails : "처리"
    processed_mails ||--o| coupons : "판별결과"
    coupons ||--o{ notifications : "발송"

    users {
        uuid id PK
        varchar email
        timestamptz created_at
        boolean notifications_enabled
    }
    mail_accounts {
        uuid id PK
        uuid user_id FK
        varchar provider
        varchar provider_account_email
        text encrypted_refresh_token
        text encrypted_access_token
        timestamptz access_token_expires_at
        jsonb cursor
        varchar status
        timestamptz created_at
    }
    processed_mails {
        uuid id PK
        uuid mail_account_id FK
        varchar provider_message_id
        varchar sender
        varchar subject
        timestamptz received_at
        varchar filter_result
        timestamptz processed_at
    }
    coupons {
        uuid id PK
        uuid processed_mail_id FK
        uuid user_id FK
        varchar discount
        date expiry_date
        text conditions
        varchar extractor_id
        varchar extractor_type
        boolean usable_now
        varchar status
        timestamptz used_at
        timestamptz created_at
    }
    devices {
        uuid id PK
        uuid user_id FK
        varchar fcm_token
        varchar platform
        timestamptz last_active_at
    }
    notifications {
        uuid id PK
        uuid coupon_id FK
        uuid device_id FK
        varchar notification_type
        varchar send_status
        timestamptz sent_at
    }
```

## 테이블 스키마 (DDL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid() 사용

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail')), -- 현재는 gmail 단일 값. 향후 제공자 추가 시 CHECK만 확장
  provider_account_email VARCHAR(255) NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,   -- AES-256-GCM, KMS 관리 키로 암호화
  encrypted_access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  cursor JSONB DEFAULT '{}',               -- { historyId }
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'reauth_required', 'auth_failed', 'revoked')),
  consecutive_failures SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, provider_account_email)
);
CREATE INDEX idx_mail_accounts_status ON mail_accounts(status) WHERE status != 'active';

CREATE TABLE processed_mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_account_id UUID NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
  provider_message_id VARCHAR(255) NOT NULL,
  sender VARCHAR(255) NOT NULL,
  subject VARCHAR(998),                    -- RFC 5322 제목 길이 제한
  received_at TIMESTAMPTZ NOT NULL,
  filter_result VARCHAR(20) NOT NULL CHECK (filter_result IN ('passed', 'filtered_out', 'extraction_failed')), -- MVP: LLM 미사용이므로 'llm_pending'/'llm_failed' 대신 'extraction_failed'(만료일 파싱 실패) 사용
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mail_account_id, provider_message_id)  -- 중복 처리 방지 핵심 제약
);
CREATE INDEX idx_processed_mails_account_date ON processed_mails(mail_account_id, received_at DESC);

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_mail_id UUID NOT NULL REFERENCES processed_mails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discount VARCHAR(100),
  expiry_date DATE,
  conditions TEXT,
  extractor_id VARCHAR(50) NOT NULL,       -- 예: 'coupang_v1', 'generic_v1' (어떤 파서가 추출했는지, 신뢰도의 대리 지표)
  extractor_type VARCHAR(20) NOT NULL CHECK (extractor_type IN ('sender_specific', 'generic_regex', 'llm')), -- 'llm'은 향후 확장용, MVP에서는 미사용
  usable_now BOOLEAN NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'dismissed')),
  used_at TIMESTAMPTZ,                     -- 사용 완료 표시 시각. MVP는 컬럼만 선반영하고 UI/API는 3단계 베타에서 활성화 (00번 문서 결정 #3)
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_coupons_user_status ON coupons(user_id, status, expiry_date);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token VARCHAR(500) NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fcm_token)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  notification_type VARCHAR(20) DEFAULT 'new_coupon' CHECK (notification_type IN ('new_coupon', 'expiry_reminder')),
  send_status VARCHAR(20) DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed', 'skipped_disabled')),
  retry_count SMALLINT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_status ON notifications(send_status) WHERE send_status = 'pending';
```

> 규칙 필터 관리 테이블(`filter_domains`, `filter_keywords`)은 02번 문서에 정의되어 있다. LLM 호출 결과를 재사용하던 `coupon_pattern_cache`는 MVP에서 LLM을 쓰지 않으므로 제거했다.

### 설계 노트
- `processed_mails.subject`, `sender`만 저장하고 본문은 저장하지 않는다 — 원본 설계의 "메일 원문 미저장" 원칙을 스키마 레벨에서 강제.
- 다중 디바이스 발송은 **사용자의 모든 활성 디바이스에 발송**하는 정책으로 확정했다 (00번 문서 결정 #2). `NotificationService`는 `devices`에서 해당 사용자의 활성 레코드를 전부 조회해 각각 `notifications` 레코드를 만든다. 무효 토큰과 90일 미접속 디바이스는 `04-푸시알림.md`의 수명주기 정책으로 정리되므로 별도 상한은 두지 않는다.
- `coupons.status`의 `used`/`dismissed`와 `used_at` 컬럼은 쿠폰 사용 추적용으로 스키마에만 선반영한 것이다 (00번 문서 결정 #3). MVP(1~2단계)에서는 쓰지 않고 3단계 베타에서 `PATCH /coupons/:id`와 함께 활성화한다 — 나중에 컬럼을 추가하는 마이그레이션을 피하려는 목적.

## REST API 명세

### 인증 관련
| 메서드 | 경로 | 설명 | 요청 | 응답 |
| --- | --- | --- | --- | --- |
| GET | `/auth/gmail/url` | Gmail OAuth 인증 URL 발급 | - | `{ url: string, state: string }` |
| POST | `/auth/gmail/callback` | Gmail 인증 코드 교환 | `{ code, state }` | `{ mailAccountId, email }` |
| DELETE | `/mail-accounts/:id` | 계정 연결 해제 (토큰 폐기 + revoke) | - | `204` |

### 사용자/디바이스
| 메서드 | 경로 | 설명 | 요청 | 응답 |
| --- | --- | --- | --- | --- |
| POST | `/devices` | 디바이스 푸시 토큰 등록 | `{ fcmToken, platform }` | `{ deviceId }` |
| DELETE | `/devices/:id` | 디바이스 등록 해제 (로그아웃 시) | - | `204` |
| PATCH | `/users/me/notification-settings` | 알림 on/off | `{ notificationsEnabled: boolean }` | `200` |

### 쿠폰
| 메서드 | 경로 | 설명 | 요청 | 응답 |
| --- | --- | --- | --- | --- |
| GET | `/coupons?status=active&sort=expiry_asc` | 쿠폰 목록 조회 | 쿼리 파라미터 | `{ coupons: Coupon[] }` |
| GET | `/coupons/:id` | 쿠폰 상세 조회 | - | `Coupon` |
| PATCH | `/coupons/:id` | 쿠폰 상태 변경 (사용함/숨김 표시) — **3단계 베타에서 활성화** | `{ status: 'used' \| 'dismissed' }` | `200` |
| POST | `/coupons/:id/feedback` | 오탐지 신고 — **3단계 베타 필수** (정확도 측정의 유일한 실측 수단, 02번 문서 참고) | `{ isAccurate: boolean }` | `204` |

### 공통 사항
- 모든 엔드포인트는 `Authorization: Bearer <session_jwt>` 필요 (앱 자체 로그인 세션, 메일 OAuth 토큰과는 별개)
- 에러 응답 포맷 통일: `{ error: { code: string, message: string } }` — 프런트에서 `code`로 분기 처리 (예: `GMAIL_TOKEN_REVOKED`, `GMAIL_AUTH_FAILED`)
- Rate limit: 사용자당 분당 60 요청 (API Gateway 레벨)

## 내부 큐 메시지 스펙

BullMQ 잡 페이로드도 인터페이스로 고정해 워커 간 계약을 명확히 한다.

```ts
// mail-ingest 큐
interface MailIngestJob {
  mailAccountId: string;
  triggeredBy: 'webhook' | 'polling';
}

// coupon-classify 큐
interface CouponClassifyJob {
  processedMailId: string;
}

// push-dispatch 큐
interface PushDispatchJob {
  couponId: string;
  notificationType: 'new_coupon' | 'expiry_reminder';
}
```
