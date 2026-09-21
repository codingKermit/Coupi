# 쿠피(Coupi) — 작업 진행 체크리스트

마지막 업데이트: 2026-09-21 · 작업 재개 시 이 파일을 가장 먼저 확인할 것

> **범위 변경 (2026-09-21)**: 메일 제공자를 Gmail 단독으로 한정했다 (네이버 메일 미지원). 사유는 `docs/00-개요.md` 참고. 이에 따라 기존 "3단계 — 네이버 메일 연동 추가"를 삭제하고 이후 단계 번호를 재정렬했다.
>
> **앱 이름 확정 (2026-09-21)**: 앱 이름을 **쿠피(Coupi)**로 확정했다. 이 저장소가 쿠피 프로젝트의 공식 작업 공간이며, GitHub(`codingKermit/Coupi`)로 이전 관리를 시작한다.
>
> **MVP는 LLM 미사용 (2026-09-21)**: 쿠폰 판별을 규칙/정규식 기반으로만 처리하기로 결정했다. 사유와 상세 설계는 `docs/00-개요.md`, `docs/02-쿠폰판별로직.md` 참고.

## 사용 방법

- 작업을 완료할 때마다 `- [ ]`를 `- [x]`로 바꾸고, 파일 상단의 "마지막 업데이트" 날짜를 갱신한다.
- 지금 하고 있는 작업에는 체크박스 뒤에 `← 진행 중`을 표시해두면 다른 디바이스에서 이어받을 때 바로 알 수 있다.
- 각 항목은 `docs/` 폴더의 해당 설계 문서를 참고해서 구현한다 (항목 옆에 문서 번호 표시).
- 새로운 하위 작업이 생기면 해당 단계 아래에 체크박스를 추가한다 — 이 파일은 계속 갱신되는 살아있는 문서다.
- 막힌 부분이 있으면 체크박스 대신 `- [ ] (블로킹) ...` 로 표시하고 사유를 한 줄 남겨서, 재개하는 사람이 왜 멈췄는지 바로 알 수 있게 한다.

## 0단계 — 착수 전 블로커 해결 (`docs/09-배포및로드맵.md` "착수 전 반드시 해결해야 할 블로커")

- [x] 메일 제공자 범위 결정 — Gmail 단독으로 확정 (네이버 제외) (`docs/00-개요.md`)
- [x] LLM 벤더/모델 확정 — MVP는 LLM 미사용으로 확정, 질문 자체가 해소됨 (`docs/00-개요.md`, `docs/02-쿠폰판별로직.md`)
- [ ] Google OAuth 보안 심사 신청 절차 시작 여부/시점 결정
- [ ] 다중 디바이스 발송 정책 결정 (`docs/00-개요.md` Open Question #2)
- [ ] 쿠폰 사용 추적 기능 MVP 포함 여부 결정 (`docs/00-개요.md` Open Question #3)
- [ ] 오탐지 신고 기능 베타 포함 여부 결정 (`docs/00-개요.md` Open Question #4)
- [ ] Gmail 외 메일 서비스 사용자를 위한 안내 문구 노출 여부 결정 (`docs/00-개요.md` Open Question #5)
- [ ] 초기 지원 발신자(전용 파서 작성 대상) 5~10곳 선정 (`docs/09-배포및로드맵.md` 블로커 #3)

## 1단계 — MVP 백엔드 (`docs/01`, `02`, `03`, `05`)

**인프라/기본 세팅**
- [ ] dev/staging/production 환경 분리, GCP 프로젝트(환경별) 생성
- [ ] PostgreSQL 인스턴스 및 `docs/03-API-DB-스펙.md`의 전체 스키마(DDL) 적용
- [ ] Redis(BullMQ용) 세팅
- [ ] Secrets Manager + KMS 키(마스터 키) 세팅

**인증 (AuthService)**
- [ ] Gmail OAuth 플로우 구현 (`GET /auth/gmail/url`, `POST /auth/gmail/callback`)
- [ ] `MailProvider` 인터페이스 및 `GmailProvider` 구현 (`docs/01-메일연동.md`)
- [ ] Refresh token AES-256-GCM 암호화 저장 (`docs/07-보안개인정보.md`)
- [ ] 계정 연결 해제 흐름 구현 (`DELETE /mail-accounts/:id`, revoke 포함)

**메일 수집 (MailIngestService)**
- [ ] Gmail webhook 수신기 구현 + Pub/Sub JWT 검증
- [ ] `users.watch()` 등록 및 갱신 배치(`gmail-watch-renewal`) 구현
- [ ] `history.list` 기반 신규 메일 조회, 404(historyId 만료) 시 재동기화 로직
- [ ] 보정 폴링 배치(`gmail-safety-poll`, 6시간 주기) 구현 (`docs/01-메일연동.md`)
- [ ] `processed_mails` 유니크 제약 기반 중복 제거 확인

**쿠폰 판별 (CouponClassifierService, MVP: LLM 미사용)**
- [ ] `filter_domains`/`filter_keywords` 테이블 및 초기 시드 데이터 적재 (`docs/02-쿠폰판별로직.md`)
- [ ] 규칙 필터 로직 구현 (도메인 우선 → 키워드 매칭)
- [ ] `CouponExtractor` 인터페이스 정의 (`docs/02-쿠폰판별로직.md`)
- [ ] 범용 정규식 파서(`GenericRegexExtractor`) 구현 (할인율/만료일/조건/스팸 키워드 패턴)
- [ ] 초기 지원 발신자별 전용 파서 구현 (블로커 #3에서 선정한 목록 기준)
- [ ] 유효성 판정 로직 구현 (`usable_now`: 만료일 파싱 성공 + 만료 전만 발송, 실패 시 보류)
- [ ] `extraction_failed` 보류 건 로깅 및 주간 리뷰 프로세스 셋업
- [ ] 만료 임박 리마인더 배치(`coupon-expiry-reminder`) 구현

**End-to-end 확인 (1단계 완료 기준)**
- [ ] 테스트 Gmail 계정으로 실제 프로모션 메일 수신 → `coupons` 레코드 생성까지 확인

## 2단계 — 모바일 앱 프로토타입 (`docs/04`, `06`)

- [ ] React Native 프로젝트 초기 세팅 (React Query, React Navigation, Firebase Messaging)
- [ ] 온보딩 화면: 인트로 → 권한 안내 → Gmail OAuth 웹뷰 (메일 서비스 선택 화면 없음, `docs/06-모바일앱구조.md`)
- [ ] 쿠폰 목록 화면 (필터 탭, 카드 UI, pull-to-refresh)
- [ ] 쿠폰 상세 화면
- [ ] 설정 화면 (연결 계정 관리, 알림 on/off)
- [ ] `POST /devices` 디바이스 토큰 등록 연동
- [ ] NotificationService: FCM 발송 구현, 페이로드 규격 적용 (`docs/04-푸시알림.md`)
- [ ] 포그라운드/백그라운드 푸시 수신 및 딥링크 처리
- [ ] 디바이스 토큰 무효화(`UNREGISTERED`) 처리 구현

**End-to-end 확인 (2단계 완료 기준)**
- [ ] 테스트 기기에서 실제 푸시 알림 수신 → 탭 시 상세 화면 진입 확인

## 3단계 — 내부 베타 (Closed Test)

- [ ] 테스트 사용자 100명 이내 등록 (Gmail 미검증 앱 제한)
- [ ] 오탐지 신고 기능(선택) 반영 여부에 따라 `/coupons/:id/feedback` 구현
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
| 2026-09-21 | 앱 이름을 "쿠피(Coupi)"로 확정, 작업 공간을 `E:\workspace\Coupi`로 이전하고 GitHub 관리 시작 |
| 2026-09-21 | MVP는 LLM 미사용으로 결정, 쿠폰 판별을 규칙/정규식 기반 구조로 재설계 (`docs/02-쿠폰판별로직.md` 전면 개정) |
