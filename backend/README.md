# 쿠피 백엔드

NestJS + TypeScript. 설계 기준은 `docs/05-백엔드아키텍처.md`, 데이터 모델은 `docs/03-API-DB-스펙.md`.

> 현재는 **골격만 있는 상태**다. 모듈과 인터페이스 계약은 잡혀 있고, 비즈니스 로직은 아직 없다.
> 다음 작업 항목은 `PROGRESS.md`의 "1단계 — MVP 백엔드" 참고.

## 구조

```
src/
  config/            환경변수 스키마 (zod) — 부팅 시 검증
  common/
    prisma/          PrismaService (전역 모듈)
    types/           DB CHECK 제약에 대응하는 유니온 타입, 내부 메시지 계약
    messaging/       Pub/Sub publisher, Cloud Tasks enqueuer (예정)
    encryption/      AES-256-GCM 유틸 (예정)
    idempotency/     at-least-once 중복 수신 방어 (예정)
  health/            /health, /health/ready
  auth/              Gmail OAuth, MailProvider 인터페이스
  mail-ingest/       webhook 수신, 보정 폴링, 중복 제거
  coupon-classifier/ 규칙 필터 + 정규식 추출/판정
  notification/      FCM 발송
  user/ coupons/ devices/   REST 컨트롤러
  jobs/              Cloud Run Jobs 진입점
```

큐가 Pub/Sub + Cloud Tasks라서 워커가 상주 프로세스가 아니라 **HTTP 컨트롤러**다.
`/internal/*` 경로가 그 진입점이며 OIDC로 보호된다 (`docs/05`).

## 로컬 개발

사전 준비: Node 22+ (현재 24), Docker Desktop.

```bash
cd backend
cp .env.example .env          # 값을 채운다
docker compose -f ../docker-compose.yml up -d   # PostgreSQL + Pub/Sub 에뮬레이터
npm install
npx prisma migrate dev        # 최초 1회 — prisma/README.md의 CHECK 제약 절차를 반드시 따를 것
npm run start:dev
```

확인:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/health/ready
```

## 스크립트

| 명령 | 내용 |
| --- | --- |
| `npm run start:dev` | 워치 모드 실행 |
| `npm run build` | `dist/`로 컴파일 |
| `npm test` | Jest |
| `npm run prisma:migrate` | 마이그레이션 생성/적용 (dev) |
| `npm run prisma:deploy` | 마이그레이션 적용 (prod) |
| `npm run prisma:studio` | 데이터 브라우저 |

## 주의

- 스키마를 바꿀 때는 `prisma/README.md`의 CHECK 제약/부분 인덱스 절차를 반드시 따른다.
  Prisma가 생성한 SQL만으로는 `docs/03`의 DDL을 완전히 재현하지 못한다.
- 모든 메시지 핸들러는 **멱등**해야 한다. Pub/Sub와 Cloud Tasks 모두 at-least-once다 (`docs/08`).
- 메일 제목/본문은 로그에 남기지 않는다 (`docs/07`).
