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
- [ ] 로컬에 Docker Desktop 설치 (현재 미설치 — 로컬 PostgreSQL/Pub-Sub 에뮬레이터 구동용)
- [ ] Secret Manager에 실제 비밀값 4건 입력 (db-password, gmail-oauth-client-secret, encryption-master-key, session-jwt-secret)

**인프라/기본 세팅**
- [x] NestJS + TypeScript 프로젝트 골격 생성 (`backend/`, 모듈 구조는 `docs/05-백엔드아키텍처.md` 기준) — 빌드/부팅 확인 완료
- [x] Prisma 스키마 작성 (`backend/prisma/schema.prisma`, `docs/03`의 DDL과 1:1) + CHECK 제약/부분 인덱스 SQL 분리 (`backend/prisma/sql/constraints.sql`)
- [x] 로컬 개발 환경 정의 (`docker-compose.yml` — PostgreSQL + Pub/Sub 에뮬레이터)
- [x] Terraform 프로젝트 구성 — 콘솔 조작 없이 IaC로만 관리 (`infra/terraform/`) ← **코드 작성 완료, 아직 apply 안 됨. terraform 미설치로 `validate`도 미실행**
- [ ] dev / prod 2개 환경 분리, 환경별 GCP 프로젝트 생성 (staging은 3단계 진입 시 추가)
- [ ] Cloud Run 서비스 2개(API, 워커) + Cloud Run Jobs(배치) 실제 배포
- [ ] Cloud SQL(PostgreSQL) 인스턴스 생성 및 Prisma 마이그레이션으로 `docs/03-API-DB-스펙.md`의 전체 스키마 적용 — `coupons.used_at` 포함 (3단계용 선반영 컬럼, 마이그레이션 회피 목적)
- [ ] Pub/Sub 토픽·구독 구성 (Gmail watch 알림 수신 겸 메일 수집 큐) + Cloud Tasks 큐 구성 (푸시 발송·만료 리마인더 예약)
- [ ] Cloud Scheduler → Cloud Run Jobs 배치 트리거 구성
- [ ] GCP Secret Manager + Cloud KMS 키(마스터 키) 세팅 — 실제 비밀값 입력은 사용자가 직접 수행 (`docs/10-기술스택결정.md` "위임할 수 없는 작업")
- [ ] 컨테이너 이미지 빌드/배포 파이프라인 (Artifact Registry + Cloud Build 또는 GitHub Actions)

**인증 (AuthService)**
- [ ] Gmail OAuth 플로우 구현 (`GET /auth/gmail/url`, `POST /auth/gmail/callback`)
- [x] `MailProvider` 인터페이스 및 `GmailProvider` 구현 (`docs/01-메일연동.md`) — OAuth/watch/history/본문 조회 전부 구현, 스코프는 `gmail.readonly` 하나로 고정
- [x] Refresh token AES-256-GCM 암호화 저장 (`docs/07-보안개인정보.md`) — envelope 방식, KMS/로컬 키 제공자 분리, 갱신 시 지연 재암호화
- [ ] 계정 연결 해제 흐름 구현 (`DELETE /mail-accounts/:id`, revoke 포함)

**메일 수집 (MailIngestService)**
- [x] Gmail webhook 수신기 구현 + Pub/Sub JWT 검증 — `POST /internal/gmail/webhook`, `PubSubPushGuard`(OIDC 검증, 운영에서 SA 이메일 필수)
- [ ] `users.watch()` 등록 및 갱신 배치(`gmail-watch-renewal`) 구현
- [x] `history.list` 기반 신규 메일 조회, 404(historyId 만료) 시 재동기화 로직 — `MailIngestService`, 최근 24시간 `messages.list` 재동기화
- [ ] 보정 폴링 배치(`gmail-safety-poll`, 6시간 주기) 구현 (`docs/01-메일연동.md`)
- [x] `processed_mails` 유니크 제약 기반 중복 제거 확인 — 사전 조회 + P2002 처리로 at-least-once 대응

**쿠폰 판별 (CouponClassifierService, MVP: LLM 미사용)**
- [ ] `filter_domains`/`filter_keywords` 초기 시드 데이터 적재 — 시드 스크립트 작성 완료(`backend/prisma/seed.ts`, 키워드 13종), 실제 적재는 DB 필요. `filter_domains`는 발신자 집계 후 채운다
- [x] 규칙 필터 로직 구현 (도메인 우선 → 키워드 매칭) — `backend/src/coupon-classifier/rule-filter.service.ts`, 5분 캐시 + 서브도메인/공백표기 대응
- [x] `CouponExtractor` 인터페이스 정의 (`backend/src/coupon-classifier/extractors/coupon-extractor.interface.ts`, `docs/02-쿠폰판별로직.md`)
- [x] 범용 정규식 파서(`GenericRegexExtractor`) 구현 (할인율/만료일/조건/스팸 키워드 패턴) — 만료일 연도 추론과 오파싱 방어 포함
- [ ] 초기 지원 발신자별 전용 파서 구현 (위 집계로 확정한 8곳 기준, `docs/02-쿠폰판별로직.md` "초기 지원 발신자 선정 절차")
- [x] 유효성 판정 로직 구현 (`usable_now`: 만료일 파싱 성공 + 만료 전만 발송, 실패 시 보류) — `ValidityCheckerService`, KST 기준
- [ ] `extraction_failed` 보류 건 로깅 및 주간 리뷰 프로세스 셋업 — 판별 결과 반환까지 구현, DB 기록은 메일 수집 핸들러 연결 시
- [ ] 만료 임박 리마인더 구현 — 쿠폰 생성 시점에 Cloud Tasks `schedule_time`으로 예약 (일일 전체 스캔 배치 불필요, `docs/05-백엔드아키텍처.md`)

**End-to-end 확인 (1단계 완료 기준)**
- [ ] 테스트 Gmail 계정으로 실제 프로모션 메일 수신 → `coupons` 레코드 생성까지 확인

## 2단계 — 모바일 앱 프로토타입 (`docs/04`, `06`)

- [ ] React Native + Expo(development build) 프로젝트 초기 세팅 (React Query, React Navigation, Firebase Messaging) — macOS 미보유로 iOS 빌드는 EAS Build 사용 (`docs/10-기술스택결정.md`)
- [ ] EAS Build 설정 및 iOS/Android 첫 빌드 통과 확인
- [ ] (사용자 직접) Apple Developer Program 등록 — iOS 개발 빌드를 실기기에 설치하려면 필수 (`docs/10-기술스택결정.md` "위임할 수 없는 작업")
- [ ] 온보딩 화면: 인트로 → 권한 안내 → Gmail OAuth 웹뷰 (메일 서비스 선택 화면 없음, `docs/06-모바일앱구조.md`)
- [ ] 쿠폰 목록 화면 (필터 탭, 카드 UI, pull-to-refresh)
- [ ] 쿠폰 상세 화면 ("사용 완료로 표시"/"숨기기" 액션은 3단계로 미룸, `docs/06-모바일앱구조.md`)
- [ ] 설정 화면 (연결 계정 관리, 알림 on/off)
- [ ] `POST /devices` 디바이스 토큰 등록 연동
- [ ] NotificationService: FCM 발송 구현, 페이로드 규격 적용 (`docs/04-푸시알림.md`)
- [ ] 포그라운드/백그라운드 푸시 수신 및 딥링크 처리
- [ ] 디바이스 토큰 무효화(`UNREGISTERED`) 처리 구현

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
