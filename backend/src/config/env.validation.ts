import { z } from 'zod';

/**
 * 환경변수 스키마. 부팅 시점에 검증해 잘못된 설정으로 뜬 인스턴스가
 * 런타임에야 실패하는 상황을 막는다.
 *
 * 비밀값(OAuth 시크릿, 암호화 마스터 키, JWT 시크릿)은 Secret Manager에서 주입한다
 * (`docs/07-보안개인정보.md`, `docs/10-기술스택결정.md`).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  // 데이터베이스
  DATABASE_URL: z.string().min(1),

  // GCP 공통
  GCP_PROJECT_ID: z.string().min(1),
  GCP_LOCATION: z.string().min(1).default('asia-northeast3'),

  // Pub/Sub 토픽 (docs/05-백엔드아키텍처.md)
  PUBSUB_TOPIC_MAIL_INGEST: z.string().min(1).default('mail-ingest'),
  PUBSUB_TOPIC_COUPON_CLASSIFY: z.string().min(1).default('coupon-classify'),
  /** Gmail watch 알림이 발행되는 토픽 (users.watch에 지정) */
  PUBSUB_TOPIC_GMAIL_NOTIFICATIONS: z
    .string()
    .min(1)
    .default('gmail-notifications'),
  /** 로컬 개발 시 Pub/Sub 에뮬레이터 주소. 설정되면 실제 GCP 대신 에뮬레이터를 쓴다. */
  PUBSUB_EMULATOR_HOST: z.string().optional(),
  /**
   * Pub/Sub push 요청의 OIDC 토큰을 검증할 때 기대하는 서비스 계정 이메일.
   * 운영에서는 필수다 (`docs/05` "내부 엔드포인트 보호").
   */
  PUBSUB_PUSH_SA_EMAIL: z.string().optional(),
  /** OIDC 토큰의 audience. 보통 push 엔드포인트 URL이다. */
  PUBSUB_PUSH_AUDIENCE: z.string().optional(),

  // Cloud Tasks 큐 (docs/05-백엔드아키텍처.md)
  CLOUD_TASKS_QUEUE_PUSH_DISPATCH: z.string().min(1).default('push-dispatch'),
  CLOUD_TASKS_QUEUE_EXPIRY_REMINDER: z
    .string()
    .min(1)
    .default('coupon-expiry-reminder'),
  /** Cloud Tasks가 호출할 워커 서비스의 베이스 URL */
  WORKER_BASE_URL: z.string().min(1),

  // Gmail OAuth (환경별로 다른 클라이언트 ID를 쓴다 — docs/05 "환경 분리")
  GMAIL_OAUTH_CLIENT_ID: z.string().min(1),
  GMAIL_OAUTH_CLIENT_SECRET: z.string().min(1),
  GMAIL_OAUTH_REDIRECT_URI: z.string().min(1),

  // 암호화 / 세션
  /** AES-256-GCM 마스터 키 (base64). KMS envelope encryption의 DEK를 감싸는 키. */
  ENCRYPTION_MASTER_KEY: z.string().min(1),
  /** Cloud KMS 키 리소스 이름. 설정되면 마스터 키 대신 KMS로 DEK를 감싼다 (운영 경로). */
  KMS_KEY_NAME: z.string().optional(),
  SESSION_JWT_SECRET: z.string().min(1),

  // 관측
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경변수 검증 실패:\n${detail}`);
  }

  return parsed.data;
}
