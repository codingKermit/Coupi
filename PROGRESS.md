# 쿠피(Coupi) — 작업 진행 체크리스트

마지막 업데이트: 2026-09-22 · 작업 재개 시 이 파일을 가장 먼저 확인할 것

> **범위 변경 (2026-09-21)**: 메일 제공자를 Gmail 단독으로 한정했다 (네이버 메일 미지원). 사유는 `docs/00-개요.md` 참고. 이에 따라 기존 "3단계 — 네이버 메일 연동 추가"를 삭제하고 이후 단계 번호를 재정렬했다.
>
> **앱 이름 확정 (2026-09-21)**: 앱 이름을 **쿠피(Coupi)**로 확정했다. 이 저장소가 쿠피 프로젝트의 공식 작업 공간이며, GitHub(`codingKermit/Coupi`)로 이전 관리를 시작한다.
>
> **MVP는 LLM 미사용 (2026-09-21)**: 쿠폰 판별을 규칙/정규식 기반으로만 처리하기로 결정했다. 사유와 상세 설계는 `docs/00-개요.md`, `docs/02-쿠폰판별로직.md` 참고.
>
> **착수 전 블로커 전건 확정 (2026-09-21)**: 0단계 결정 항목을 모두 확정해 개발 착수 블로커가 없어졌다. 결정 내용과 근거는 `docs/00-개요.md` "착수 전 결정 사항", `docs/09-배포및로드맵.md` "착수 전 블로커" 참고. 단, **CASA 심사 대상 여부와 비용 확인**은 결정이 아니라 사실 확인 항목으로 남아 있고 결과에 따라 4단계 계획이 바뀔 수 있다.

## 사용 방법

- 작업을 완료할 때마다 `- [ ]`를 `- [x]`로 바꾸고, 파일 상단의 "마지막 업데이트" 날짜를 갱신한다.
- 지금 하고 있는 작업에는 체크박스 뒤에 `← 진행 중`을 표시해두면 다른 디바이스에서 이어받을 때 바로 알 수 있다.
- 각 항목은 `docs/` 폴더의 해당 설계 문서를 참고해서 구현한다 (항목 옆에 문서 번호 표시).
- 새로운 하위 작업이 생기면 해당 단계 아래에 체크박스를 추가한다 — 이 파일은 계속 갱신되는 살아있는 문서다.
- 막힌 부분이 있으면 체크박스 대신 `- [ ] (블로킹) ...` 로 표시하고 사유를 한 줄 남겨서, 재개하는 사람이 왜 멈췄는지 바로 알 수 있게 한다.

## 0단계 — 착수 전 블로커 해결 (`docs/09-배포및로드맵.md` "착수 전 블로커") ✅ 완료

- [x] 메일 제공자 범위 결정 — Gmail 단독으로 확정 (네이버 제외) (`docs/00-개요.md`)
- [x] LLM 벤더/모델 확정 — MVP는 LLM 미사용으로 확정, 질문 자체가 해소됨 (`docs/00-개요.md`, `docs/02-쿠폰판별로직.md`)
- [x] Google OAuth 보안 심사 착수 시점 결정 — **단계 분할 착수**: 문서류/동의화면은 1단계와 병행해 지금 착수, 데모 영상·제출은 2단계 완료 후 (`docs/09-배포및로드맵.md`)
- [x] 다중 디바이스 발송 정책 결정 — **모든 활성 디바이스에 발송** (`docs/00-개요.md` 결정 #2, `docs/04-푸시알림.md`)
- [x] 쿠폰 사용 추적 기능 MVP 포함 여부 결정 — **스키마(`coupons.used_at`)만 선반영, UI/API는 3단계 베타** (`docs/00-개요.md` 결정 #3)
- [x] 오탐지 신고 기능 베타 포함 여부 결정 — **3단계 베타 필수 포함** (`docs/00-개요.md` 결정 #4)
- [x] Gmail 외 메일 서비스 사용자 안내 문구 결정 — **"현재 Gmail 계정만 지원" 사실만 표기** (`docs/00-개요.md` 결정 #5)
- [x] 초기 지원 발신자 선정 — **목록이 아니라 선정 절차를 확정**(실제 메일함 집계 → 카테고리 슬롯 8곳), 목록은 1단계와 병행해 확정 (`docs/02-쿠폰판별로직.md` "초기 지원 발신자 선정 절차")

**다음 할 일 (0단계 결정에 따라 지금 바로 착수 가능한 것)**
- [ ] (최우선) CASA 심사 대상 여부 및 비용 확인 — 결과에 따라 4단계 일정/예산 재조정 필요 (`docs/07-보안개인정보.md`, `docs/09-배포및로드맵.md`)
- [ ] 초기 지원 발신자 집계 스크립트 실행 (Gmail 계정 3~5개, 최근 90일 프로모션 메일 발신자 도메인별 집계) → 8곳 확정 + 파서용 메일 샘플 수집
- [ ] GCP 프로젝트/OAuth 동의화면 구성, 개인정보처리방침·이용약관 게시, 보안 백서 초안 (1단계와 병행)

## 1단계 — MVP 백엔드 (`docs/01`, `02`, `03`, `05`)

**사용자가 직접 해야 하는 선행 작업** (`docs/10-기술스택결정.md` "위임할 수 없는 작업")
- [ ] (블로킹) GCP 계정 생성 및 결제 수단 등록 — 이게 없으면 아래 인프라 항목을 하나도 적용할 수 없다
- [ ] (블로킹) dev/prod GCP 프로젝트 생성
- [ ] Terraform 상태 저장용 GCS 버킷 생성 (`infra/terraform/README.md` "사전 준비")
- [ ] 로컬에 gcloud CLI, Terraform 설치 (현재 미설치) + `gcloud auth application-default login`
- [ ] Docker Desktop 또는 gcloud CLI 설치 — DB는 Neon으로 해결됐고, 이제 Pub/Sub 에뮬레이터 용도로만 필요하다 (메일 수집→판별 경로 로컬 검증용)
- [ ] Secret Manager에 실제 비밀값 4건 입력 (db-password, gmail-oauth-client-secret, encryption-master-key, session-jwt-secret)

**인프라/기본 세팅**
- [x] NestJS + TypeScript 프로젝트 골격 생성 (`backend/`, 모듈 구조는 `docs/05-백엔드아키텍처.md` 기준) — 빌드/부팅 확인 완료
- [x] Prisma 스키마 작성 (`backend/prisma/schema.prisma`, `docs/03`의 DDL과 1:1) + CHECK 제약/부분 인덱스 SQL 분리 (`backend/prisma/sql/constraints.sql`)
- [x] 로컬 개발 환경 정의 (`docker-compose.yml` — PostgreSQL + Pub/Sub 에뮬레이터)
- [x] Terraform 프로젝트 구성 — 콘솔 조작 없이 IaC로만 관리 (`infra/terraform/`) ← **코드 작성 완료, 아직 apply 안 됨. terraform 미설치로 `validate`도 미실행**
- [ ] dev / prod 2개 환경 분리, 환경별 GCP 프로젝트 생성 (staging은 3단계 진입 시 추가)
- [ ] Cloud Run 서비스 2개(API, 워커) + Cloud Run Jobs(배치) 실제 배포
- [ ] Cloud SQL(PostgreSQL) 인스턴스 생성 — **dev는 Neon에 적용 완료(2026-09-30)**, prod는 GCP 계정 이후
- [x] Prisma 마이그레이션으로 `docs/03-API-DB-스펙.md`의 전체 스키마 적용 — Neon(PG18)에서 검증 완료. CHECK 제약 8개·부분 인덱스 2개 반영 및 거부 동작 확인
- [ ] Pub/Sub 토픽·구독 구성 (Gmail watch 알림 수신 겸 메일 수집 큐) + Cloud Tasks 큐 구성 (푸시 발송·만료 리마인더 예약)
- [ ] Cloud Scheduler → Cloud Run Jobs 배치 트리거 구성
- [ ] GCP Secret Manager + Cloud KMS 키(마스터 키) 세팅 — 실제 비밀값 입력은 사용자가 직접 수행 (`docs/10-기술스택결정.md` "위임할 수 없는 작업")
- [ ] 컨테이너 이미지 빌드/배포 파이프라인 (Artifact Registry + Cloud Build 또는 GitHub Actions) — `backend/Dockerfile` 작성 완료(서버·배치 공용 이미지), CI 연결은 미구현

**인증 (AuthService)**
- [x] Gmail OAuth 플로우 구현 (`GET /auth/gmail/url`, `POST /auth/gmail/callback`) — 콜백이 회원가입 겸 로그인, 세션 JWT 발급, state 기반 CSRF 방지, 연결 직후 watch 등록
- [x] `MailProvider` 인터페이스 및 `GmailProvider` 구현 (`docs/01-메일연동.md`) — OAuth/watch/history/본문 조회 전부 구현, 스코프는 `gmail.readonly` 하나로 고정
- [x] Refresh token AES-256-GCM 암호화 저장 (`docs/07-보안개인정보.md`) — envelope 방식, KMS/로컬 키 제공자 분리, 갱신 시 지연 재암호화
- [x] 계정 연결 해제 흐름 구현 (`DELETE /mail-accounts/:id`, revoke 포함) — `docs/07` 순서대로 status 변경 → revoke → 토큰 컬럼 NULL

**메일 수집 (MailIngestService)**
- [x] Gmail webhook 수신기 구현 + Pub/Sub JWT 검증 — `POST /internal/gmail/webhook`, `PubSubPushGuard`(OIDC 검증, 운영에서 SA 이메일 필수)
- [x] `users.watch()` 등록 및 갱신 배치(`gmail-watch-renewal`) 구현 — 최초 등록은 OAuth 콜백, 갱신은 Cloud Run Job. 만료 3일 이내 계정만 대상, 3회 연속 실패 시 재인증 필요로 전환
- [x] `history.list` 기반 신규 메일 조회, 404(historyId 만료) 시 재동기화 로직 — `MailIngestService`, 최근 24시간 `messages.list` 재동기화
- [x] 보정 폴링 배치(`gmail-safety-poll`, 6시간 주기) 구현 (`docs/01-메일연동.md`) — 활성 계정을 수집 큐에 재적재, 중복은 기존 유니크 제약이 처리
- [x] `processed_mails` 유니크 제약 기반 중복 제거 확인 — 사전 조회 + P2002 처리로 at-least-once 대응

**쿠폰 판별 (CouponClassifierService, MVP: LLM 미사용)**
- [x] `filter_keywords` 초기 시드 데이터 적재 — Neon에 13종 적재 완료, 재실행 멱등성 확인. `filter_domains`는 발신자 집계 후 채운다
- [x] 규칙 필터 로직 구현 (도메인 우선 → 키워드 매칭) — `backend/src/coupon-classifier/rule-filter.service.ts`, 5분 캐시 + 서브도메인/공백표기 대응
- [x] `CouponExtractor` 인터페이스 정의 (`backend/src/coupon-classifier/extractors/coupon-extractor.interface.ts`, `docs/02-쿠폰판별로직.md`)
- [x] 범용 정규식 파서(`GenericRegexExtractor`) 구현 (할인율/만료일/조건/스팸 키워드 패턴) — 만료일 연도 추론과 오파싱 방어 포함
- [ ] 초기 지원 발신자별 전용 파서 구현 (위 집계로 확정한 8곳 기준, `docs/02-쿠폰판별로직.md` "초기 지원 발신자 선정 절차")
- [x] 유효성 판정 로직 구현 (`usable_now`: 만료일 파싱 성공 + 만료 전만 발송, 실패 시 보류) — `ValidityCheckerService`, KST 기준
- [ ] `extraction_failed` 보류 건 로깅 및 주간 리뷰 프로세스 셋업 — DB 기록은 구현 완료(`CouponClassifyService`가 `processed_mails.filter_result` 갱신), 주간 리뷰 절차·리포트는 미구현
- [x] 만료 임박 리마인더 구현 — 쿠폰 생성 시점 예약(`expiryReminderTime`) + `/internal/expiry-reminder` 발송 핸들러 완료

**End-to-end 확인 (1단계 완료 기준)**
- [ ] 테스트 Gmail 계정으로 실제 프로모션 메일 수신 → `coupons` 레코드 생성까지 확인

## 2단계 — 모바일 앱 프로토타입 (`docs/04`, `06`)

- [x] React Native + Expo 프로젝트 초기 세팅 (React Query, React Navigation, Zustand) — `mobile/`, Expo SDK 57 / RN 0.86. Android 번들 빌드 통과. Firebase Messaging은 GCP 프로젝트 연동 후
- [ ] EAS Build 설정 및 iOS/Android 첫 빌드 통과 확인
- [ ] (사용자 직접) Apple Developer Program 등록 — iOS 개발 빌드를 실기기에 설치하려면 필수 (`docs/10-기술스택결정.md` "위임할 수 없는 작업")
- [x] 온보딩 화면: 권한 안내 → Gmail OAuth (메일 서비스 선택 화면 없음, `docs/06-모바일앱구조.md`) — 실기기 동작 확인은 미실시
- [x] 쿠폰 목록 화면 (필터 탭 3종, 카드 UI, D-day 배지, pull-to-refresh, 빈 상태) — 실기기 동작 확인은 미실시
- [x] 쿠폰 상세 화면 ("사용 완료로 표시"/"숨기기" 액션은 3단계로 미룸, `docs/06-모바일앱구조.md`) — 원본 메일 링크 포함
- [x] 설정 화면 (연결 계정 목록·개별 해제, 알림 on/off, 로그아웃) — 해제 시 쿠폰 기록도 삭제됨을 사전 고지 (`docs/07`)
- [x] `POST /devices` 디바이스 토큰 등록 연동 — 서버 구현 완료(upsert로 `onTokenRefresh` 재등록 대응), 앱 연동은 2단계
- [x] NotificationService: FCM 발송 구현, 페이로드 규격 적용 (`docs/04-푸시알림.md`) — HTTP v1 직접 호출, 다중 디바이스 전체 발송, 부분 실패 시 성공분 건너뛰고 재시도
- [ ] 포그라운드/백그라운드 푸시 수신 및 딥링크 처리
- [x] 디바이스 토큰 무효화(`UNREGISTERED`) 처리 구현 — 영구 실패로 분류해 재시도하지 않고 `devices` 레코드 즉시 삭제

**End-to-end 확인 (2단계 완료 기준)**
- [ ] 테스트 기기에서 실제 푸시 알림 수신 → 탭 시 상세 화면 진입 확인

## 3단계 — 내부 베타 (Closed Test)

- [ ] 테스트 사용자 100명 이내 등록 (Gmail 미검증 앱 제한)
- [ ] 오탐지 신고 기능 구현 (`POST /coupons/:id/feedback` + 상세 화면 👍👎 버튼) — **필수**, 규칙 기반 판별의 오탐지를 실측할 유일한 수단 (`docs/02-쿠폰판별로직.md`)
- [ ] 쿠폰 사용 추적 활성화 (`PATCH /coupons/:id` + 상세 화면 "사용 완료로 표시"/"숨기기") — 0단계 결정 #3에 따라 이 시점에 추가
- [ ] 정밀도/미탐지 측정 대시보드 구성, 발신자별 `extraction_failed` 비율 추적 (`docs/02-쿠폰판별로직.md`)
- [ ] `docs/08-에러처리및엣지케이스.md`의 운영 알림(Alerting) 기준 적용 확인
- [ ] 베타 피드백 기반 규칙 필터 키워드/도메인 보정

## 4단계 — Google OAuth 보안 심사 제출

- [ ] 개인정보처리방침/이용약관 게시
- [ ] 데모 영상 제작
- [ ] 보안 백서 작성 (`docs/07-보안개인정보.md` 기반)
- [ ] CASA 심사 대상 여부 확인 및 해당 시 체크리스트 진행
- [ ] 심사 제출

## 5단계 — 심사 대기 중 마무리 작업

- [ ] Apple App Privacy 설문지 작성
- [ ] Google Play Data Safety 섹션 작성
- [ ] 모니터링/로깅 셋업 완료 확인 (`docs/05-백엔드아키텍처.md`)
- [ ] 프로덕션 인프라 스케일링 설정 점검

## 6단계 — 정식 출시

- [ ] 롤아웃 10%
- [ ] 롤아웃 50%
- [ ] 롤아웃 100%

---

## 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-09-21 | 상세 설계 문서(`docs/00~09`) 작성 완료, 이 체크리스트 최초 생성 |
| 2026-09-21 | 범위를 Gmail 단독으로 변경, 네이버 연동 단계 삭제 및 이후 단계 번호 재정렬 |
| 2026-09-21 | 앱 이름을 "쿠피(Coupi)"로 확정, 작업 공간을 `E:\workspace\Coupi`로 이전하고 GitHub 관리 시작 (현재 로컬 경로는 `C:\workspace\Coupi`) |
| 2026-09-21 | MVP는 LLM 미사용으로 결정, 쿠폰 판별을 규칙/정규식 기반 구조로 재설계 (`docs/02-쿠폰판별로직.md` 전면 개정) |
| 2026-09-21 | 착수 전 블로커/Open Question 전건 확정 — 다중 디바이스 전체 발송, 쿠폰 사용 추적 스키마만 선반영, 오탐지 신고 베타 필수, Gmail 전용 안내 문구, OAuth 심사 단계 분할 착수, 발신자 선정 절차 확정 (`docs/00`, `02`, `03`, `04`, `06`, `09` 반영) |
| 2026-09-22 | 기술 스택 확정 (`docs/10-기술스택결정.md` 신규) — GCP 단독 / Cloud Run / Pub/Sub·Cloud Tasks(Redis·BullMQ 대체) / NestJS+TypeScript / Prisma / React Native+Expo / Terraform / dev+prod 2환경. 그간 "제안"이던 스택이 확정처럼 적혀 있던 1·2단계 항목을 실제 결정에 맞춰 교체 |
| 2026-09-22 | 스택 확정에 맞춰 설계 문서 정리 — `05`(큐/인프라 전면 재작성), `08`(재시도·알림 기준), `03`(Prisma 마이그레이션 + 메시지 스펙), `01`·`04`·`07`(잔여 BullMQ/Datadog 참조 제거), 원본 설계문서에 superseded 안내 추가. 워커 Cloud Run은 Pub/Sub push 방식이라 `min-instances=0` 가능 — 고정비는 Cloud SQL 하나로 줄었다 |
| 2026-09-22 | 1단계 착수 — `backend/` NestJS+TypeScript 골격(모듈 9개, 환경변수 zod 검증, health 엔드포인트, Prisma 스키마), `infra/terraform/` GCP 인프라 코드, `docker-compose.yml` 로컬 환경, README 3종 작성. 빌드와 부팅 확인 완료(DB 연결에서만 실패 — 로컬 PostgreSQL 없음). Terraform은 코드만 작성했고 apply/validate 미실행 |
| 2026-09-22 | 쿠폰 판별 파이프라인 구현 — 규칙 필터(도메인 우선 → 키워드), 범용 정규식 파서, 만료일 파서, 유효성 판정, 추출기 레지스트리. 단위 테스트 59건 통과. 구현 중 드러난 두 가지를 문서에 반영: `extract()`에 `receivedAt` 컨텍스트 추가(연말 연도 추론), 만료일 타당성 기준을 "오늘"에서 "수신일"로 정교화(만료 건이 `extraction_failed` 통계를 오염시키는 문제) |
| 2026-09-22 | GmailProvider와 메일 수집 핸들러 구현 — OAuth/watch/history 조회/본문 파싱, envelope 암호화(KMS·로컬 키 제공자 분리), Pub/Sub push OIDC 검증 가드, webhook 수신기, 수집 서비스(커서 만료 시 24시간 재동기화, 유니크 제약 기반 중복 제거). 테스트 92건 통과. 수집 단계 규칙 필터는 메타데이터만 보도록 결정하고 `docs/01`에 대가를 기록 |
| 2026-09-22 | `coupon-classify` 핸들러 구현 — 본문 조회 → 판별 → `coupons` 생성 → 푸시 발송/만료 리마인더 Cloud Tasks 적재. 규칙 필터를 다시 돌리지 않도록 `extractAndJudge()` 분리, 쿠폰 존재 여부로 멱등성 확보. Cloud Tasks 적재기 추가, Pub/Sub 가드·DTO를 `common/messaging`으로 이동. 리마인더를 쿠폰 생성 시점 예약으로 바꾼 내용을 `docs/02`에 반영. 테스트 105건 통과 |
| 2026-09-23 | NotificationService 구현 — FCM HTTP v1 발송(`fcm.client.ts`, firebase-admin 없이 ADC+fetch), 푸시 문구 생성, 다중 디바이스 전체 발송, 무효 토큰 즉시 삭제, 부분 실패 시 성공분 제외 재시도. `/internal/push-dispatch`와 `/internal/expiry-reminder` 핸들러 추가. Pub/Sub 전용이던 가드를 `InternalCallerGuard`로 일반화(Cloud Tasks도 OIDC로 호출). Cloud Tasks 재시도 정책을 `docs/04` 기준에 맞춰 조정하고 근사임을 문서화. 테스트 124건 통과 |
| 2026-09-23 | OAuth 엔드포인트와 계정 연결 해제 구현 — 세션 JWT(`SessionService`, state 기반 CSRF 방지), `SessionGuard`, `GET /auth/gmail/url`, `POST /auth/gmail/callback`(회원가입 겸 로그인 + watch 등록), `DELETE /mail-accounts/:id`. 설계 공백 두 건을 바로잡았다: `docs/03`에 로그인 엔드포인트가 없어 세션 JWT 출처가 비어 있던 문제(콜백이 발급하도록 보완), `encrypted_refresh_token`이 NOT NULL이라 `docs/07`의 "NULL로 덮어쓰기" 절차와 충돌하던 문제(nullable로 변경). `@nestjs/jwt` v11이 ESM 전용이라 `jsonwebtoken` 직접 사용으로 교체. 테스트 132건 통과 |
| 2026-09-30 | 배치 2종 구현 — `gmail-watch-renewal`(만료 3일 이내 계정만 재구독, 연속 실패 3회 시 재인증 전환), `gmail-safety-poll`(활성 계정을 수집 큐에 재적재). 서버와 배치가 같은 이미지를 쓰도록 `main.ts`에 잡 러너를 두고 `Dockerfile` 추가. watch 만료 시각을 둘 곳이 없어 `mail_accounts.cursor`를 `{ historyId, watchExpiresAt }`으로 확장하고 `docs/01`·`docs/03`에 기록. 테스트 143건 통과 |
| 2026-09-30 | REST API 구현 — `GET /coupons`(탭별 필터 active/expiring/expired, 정렬), `GET /coupons/:id`, `POST /devices`, `DELETE /devices/:id`, `PATCH /users/me/notification-settings`. 조회는 전부 `userId`를 조건에 넣어 타인 데이터 접근을 막는다. 응답 형태가 정의돼 있지 않던 `Coupon`을 화면 요구사항 기준으로 정하고 `docs/03`에 기록. 만료 처리 배치 대신 조회 시점 판단을 택함. `docs/06`의 "쿠폰 코드 복사 버튼"은 컬럼·추출기가 모두 없어 미구현임을 문서에 명시. 테스트 160건 통과 |
| 2026-09-30 | dev DB를 Neon(무료 서버리스 Postgres)으로 결정 — 로컬 DB 서버를 두지 않기로 했고 GCP 계정이 없어 Cloud SQL을 띄울 수 없다. Supabase는 1주 무활동 정지 때문에 배제. 운영은 CASA 사유로 Cloud SQL 유지. Neon의 풀링/직접 엔드포인트 분리에 맞춰 `schema.prisma`에 `directUrl` 추가, 환경변수를 `DATABASE_URL`/`DIRECT_DATABASE_URL`로 분리. `docs/10`에 결정 기록 |
| 2026-09-30 | Neon(PostgreSQL 18)에 dev DB 구축 완료 — 최초 마이그레이션 적용, CHECK 제약 8개·부분 인덱스 2개 반영 및 거부 동작 검증, 시드 13종 적재(멱등성 확인). 서버 기동 후 실제 데이터로 REST API 전수 확인: 쿠폰 필터 3종·정렬·상세, 디바이스 upsert/삭제, 알림 설정, 미인증 401, 타인 데이터 404/403, 잘못된 enum 400. Neon 연결 문자열의 `channel_binding=require`가 Prisma P1010을 유발해 `sslmode=verify-full&channel_binding=disable` 조합으로 해결하고 문서화 |
| 2026-09-30 | Pub/Sub 수집 경로 부분 검증 — 에뮬레이터 실행 수단(Docker/gcloud)이 없어 전 구간은 못 돌렸지만, 실제 Pub/Sub push 봉투로 webhook을 호출해 봉투 디코딩·계정 조회·발행 진입까지 확인. 이 과정에서 버그 3건 발견·수정: (1) 발행 실패 시 GCP 클라이언트의 처리되지 않은 거부가 **프로세스를 죽임** → 서버는 기록만, 배치는 종료코드 실패로 구분 처리, (2) ordering key 발행 실패 시 클라이언트가 그 키를 **영구 정지**시켜 해당 계정의 이후 메시지가 전부 실패 → resumePublishing 호출 추가, (3) 보정 폴링이 **모든 적재에 실패해도 성공으로 보고** → 안전망이 조용히 사라지므로 실패 시 비정상 종료. docs/01·08에 기록 |
| 2026-10-01 | **Gmail OAuth 실연동 성공** — GCP 프로젝트(`coupi-dev`) + OAuth 클라이언트 발급 후 실제 Gmail 계정 연결 완료. 검증: 토큰 envelope 암호화 저장(평문 노출 없음), 복호화, Gmail 프로필 조회, 최근 7일 메일 33건 조회, 제목·발신자 파싱 33/33, 본문 MIME 순회 + HTML 평문화. watch 등록은 Pub/Sub 토픽 부재로 실패했으나 설계대로 연결은 성공 처리되고 보정 폴링에 위임됨(결제 미등록이라 Pub/Sub 사용 불가). `docs/03`이 콜백을 POST로만 정의했는데 Google은 GET으로 리디렉션해 흐름이 완성되지 않던 문제를 발견, GET 핸들러 추가하고 문서 반영 |
| 2026-10-01 | 발신자 집계 1차 실행 (`backend/scripts/aggregate-senders.ts`, `diagnose-filter.ts` 신규) — 본인 계정 90일 351건 측정. **중요한 수치 2건**: (1) 현재 규칙 필터 통과율이 2.6%(9/351)에 그침. 본문까지 보면 2배로 늘지만 여전히 낮음. (2) **Gmail 자체 프로모션 카테고리는 44건(12.5%)을 잡는데, 우리 필터는 그 중 9건(20.5%)만 통과시킴** — 즉 프로모션 메일의 약 80%를 놓치고 있다. 또한 이 계정은 LinkedIn이 202/351(58%)로 한국 이커머스 발신자가 거의 없어 8곳 슬롯을 채울 수 없다 — `docs/02`가 정한 대로 지인 계정 3~5개가 필요 |
| 2026-10-01 | 추출 품질 1차 측정 (`backend/scripts/measure-extraction.ts`, `review-holds.ts` 신규) — Gmail 프로모션 44건에 추출·판정 파이프라인 실행. 발송 대상 1건(2.3%), 보류 33건(75%), 만료 10건(22.7%). **ezwel만 범용 파서가 읽어낸다**(12건 중 11건 만료일 파싱, 그 중 10건은 실제 만료라 올바르게 걸러짐). doordash·xcaret은 25건 전부 만료일 미검출. 단, **보류 33건에는 "파서가 놓친 진짜 쿠폰"과 "애초에 쿠폰이 아닌 뉴스레터"가 섞여 있어 자동 지표로 구분 불가** — `docs/02`의 "미탐지 프록시" 절차대로 사람 검토가 필요하다. `review-holds.csv`(gitignore)로 검토 목록 생성 |
| 2026-10-01 | **2단계 모바일 앱 착수** — `mobile/` Expo SDK 57 / RN 0.86 / React 19. React Query + Zustand + React Navigation 7. 화면 4종(온보딩·쿠폰 목록·상세·설정), 세션 토큰은 SecureStore(키체인)에 보관. Android 번들 빌드 통과(2.1MB). OAuth 앱 복귀를 위해 백엔드에 `OAUTH_SUCCESS_REDIRECT` 설정을 추가(설정 시 302 딥링크, 미설정 시 기존 JSON 유지). 딥링크 스킴을 `myapp://`에서 `coupi://`로 확정하고 `docs/06`에 반영. **실기기 동작은 아직 확인하지 못했다** — 번들 빌드까지만 검증 |
| 2026-10-01 | 문서에만 있고 구현이 빠져 있던 두 가지 처리 — (1) `docs/03`의 공통 에러 포맷 `{ error: { code, message } }`을 전역 예외 필터로 구현. Nest 기본 응답은 `{ statusCode, message, error }`라 앱이 두 형태를 다뤄야 했다. 5xx는 메시지를 노출하지 않는다. (2) `docs/06`의 설정 화면이 요구하는 연결 계정 목록 조회 수단이 없어 `GET /mail-accounts` 추가(토큰 컬럼 미노출, revoked 제외). 앱에 설정 화면 계정 목록·개별 해제와 홈 상단 재인증 배너를 붙였다. 실서버로 에러 포맷 4종·목록 응답·`needsReauth` 조건 확인, Android 번들 빌드 통과 |
