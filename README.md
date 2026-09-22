# 쿠피 (Coupi)

Gmail 계정에 도착하는 쿠폰/프로모션 메일을 실시간으로 감지하고, 실제로 사용 가능한 쿠폰인지 판별해 모바일 푸시 알림으로 전달하는 앱.

## 현재 상태

- **1단계(MVP 백엔드) 착수** — 백엔드 골격과 인프라 코드 작성 완료, GCP 프로젝트 생성 전
- 메일 제공자 범위: **Gmail 단독** (네이버 메일은 지원하지 않음 — 사유는 `docs/00-개요.md`)
- 쿠폰 판별: **규칙/정규식 기반** (MVP는 LLM 미사용 — `docs/02-쿠폰판별로직.md`)
- 지금 무엇을 해야 하는지는 [`PROGRESS.md`](./PROGRESS.md) 확인

## 저장소 구조

| 경로 | 내용 |
| --- | --- |
| [`backend/`](./backend) | NestJS 백엔드 (API + 워커 + 배치) |
| [`infra/terraform/`](./infra/terraform) | GCP 인프라 (IaC) — 콘솔 조작 없이 여기서만 관리 |
| [`docker-compose.yml`](./docker-compose.yml) | 로컬 개발용 PostgreSQL + Pub/Sub 에뮬레이터 |
| [`docs/`](./docs) | 상세 설계 문서 |
| [`PROGRESS.md`](./PROGRESS.md) | 작업 진행 체크리스트 — 작업을 재개할 때 가장 먼저 볼 파일 |

## 문서

| 경로 | 내용 |
| --- | --- |
| [`docs/00-개요.md`](./docs/00-개요.md) | 설계 문서 인덱스, 범위 변경 이력, **확정된 결정 사항 표** |
| [`docs/01`](./docs/01-메일연동.md) ~ [`09`](./docs/09-배포및로드맵.md) | 주제별 상세 설계 (메일 연동, 쿠폰 판별, API/DB, 푸시, 백엔드, 모바일, 보안, 에러 처리, 배포) |
| [`docs/10-기술스택결정.md`](./docs/10-기술스택결정.md) | 기술 스택 확정과 근거, **위임할 수 없는 작업 목록** |
| [`메일_쿠폰_알림_앱_기술_아키텍처_설계.md`](./메일_쿠폰_알림_앱_기술_아키텍처_설계.md) | 최초 설계 원본 (baseline, 일부 내용이 대체됨 — 문서 상단 안내 참고) |

## 기술 스택

확정 근거와 검토한 대안은 [`docs/10-기술스택결정.md`](./docs/10-기술스택결정.md) 참고.

| 계층 | 선택 |
| --- | --- |
| 클라우드 | GCP 단독 |
| 실행 | Cloud Run (API/워커) + Cloud Run Jobs (배치) |
| 큐 | Pub/Sub (수집) + Cloud Tasks (발송·예약) |
| DB | Cloud SQL (PostgreSQL) + Prisma |
| 백엔드 | Node.js + NestJS + TypeScript |
| 모바일 | React Native + Expo (EAS Build) |
| 메일 연동 | Gmail API (OAuth 2.0, Pub/Sub push) |
| 쿠폰 판별 | 규칙 필터 + 정규식 파서 (MVP는 LLM 미사용) |
| 푸시 | FCM (Android), FCM 경유 APNs (iOS) |
| 인프라 | Terraform |
| 관측 | Cloud Logging/Monitoring + Sentry |

## 시작하기

```bash
cd backend
cp .env.example .env
npm install
npm run build
```

로컬 실행에는 PostgreSQL이 필요하다. 자세한 절차는 [`backend/README.md`](./backend/README.md),
인프라 구축은 [`infra/terraform/README.md`](./infra/terraform/README.md) 참고.

GCP 계정·결제 등록, OAuth 동의화면, 스토어 개발자 등록처럼 **직접 해야 하는 작업**은
`docs/10-기술스택결정.md`의 "위임할 수 없는 작업" 표에 정리되어 있다.
