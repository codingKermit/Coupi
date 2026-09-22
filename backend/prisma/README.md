# Prisma 스키마 운영 규칙

## 기준 정의

스키마의 기준은 `docs/03-API-DB-스펙.md`의 DDL이다 (규칙 필터 테이블은 `docs/02-쿠폰판별로직.md`).
`schema.prisma`는 그 DDL을 Prisma 문법으로 옮긴 것이며, **둘이 어긋나면 문서 쪽이 옳다.**

## Prisma로 표현할 수 없어 SQL로 직접 넣어야 하는 것

Prisma 스키마에는 CHECK 제약과 부분 인덱스(WHERE 절)를 쓸 수 없다. 따라서 최초 마이그레이션 생성 후
`prisma/sql/constraints.sql`의 내용을 마이그레이션 파일 끝에 **직접 붙여넣어** 커밋한다.

절차:

```bash
npx prisma migrate dev --create-only --name init   # SQL만 생성하고 적용은 보류
# 생성된 prisma/migrations/<타임스탬프>_init/migration.sql 끝에 prisma/sql/constraints.sql 내용을 추가
npx prisma migrate dev                              # 적용
```

이후 스키마를 바꿀 때도 CHECK 대상 컬럼을 건드렸다면 같은 방식으로 제약을 다시 확인한다.

## 왜 enum을 쓰지 않는가

`status`, `provider`, `filter_result` 같은 컬럼은 PostgreSQL enum 대신 `VARCHAR + CHECK`로 정의했다.
DDL 주석("향후 제공자 추가 시 CHECK만 확장")에 따른 것으로, PG enum은 값 추가/제거 시 타입 변경이
필요해 마이그레이션이 번거롭다. 애플리케이션 레벨의 타입 안전성은 `src/common/types/`의 유니온 타입과
`class-validator`의 `@IsIn()`으로 확보한다.

## 마이그레이션 파일은 반드시 커밋한다

dev와 prod의 스키마를 동일하게 유지하는 유일한 수단이다 (`docs/10-기술스택결정.md`).
prod 적용은 `prisma migrate deploy`를 사용한다 (`migrate dev`는 prod에서 쓰지 않는다).
