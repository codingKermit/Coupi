# 인프라 (Terraform)

쿠피의 GCP 인프라를 코드로 정의한다. **콘솔에서 직접 만들지 않는다** — 재현 가능성과
dev/prod 동일성을 위해서다 (`docs/10-기술스택결정.md`).

> **아직 한 번도 apply되지 않았다.** 로컬에 terraform/gcloud가 설치되어 있지 않아
> `terraform validate`조차 돌려보지 못한 상태다. 첫 apply 전에 반드시 `plan`으로 검토할 것.

## 구성

| 파일 | 내용 |
| --- | --- |
| `versions.tf` | provider 버전, GCS 상태 백엔드 |
| `variables.tf` | 프로젝트/환경/리전/이미지/DB 사양 |
| `apis.tf` | 필요한 GCP API 활성화 |
| `pubsub.tf` | 토픽 4개(gmail-notifications, mail-ingest, coupon-classify, dead-letter)와 push 구독 |
| `cloud_tasks.tf` | 큐 2개(push-dispatch, coupon-expiry-reminder) |
| `cloudsql.tf` | PostgreSQL 인스턴스/DB/사용자 |
| `cloud_run.tf` | API(공개)와 워커(내부 전용) 서비스 |
| `scheduler.tf` | 배치 Job 2개와 스케줄 |
| `secrets.tf` | Secret Manager 컨테이너, KMS 키링/키 |
| `iam.tf` | 서비스 계정과 최소 권한 역할 |

## 사전 준비 (사용자가 직접)

Terraform이 만들 수 없는 것들이다. `docs/10-기술스택결정.md`의 "위임할 수 없는 작업" 참고.

1. **GCP 프로젝트 생성과 결제 계정 연결** (dev/prod 각각)
2. **상태 저장용 GCS 버킷 생성** — 상태를 담을 버킷을 상태로 관리할 수 없으므로 수동으로 한 번만 만든다

   ```bash
   gcloud storage buckets create gs://coupi-tfstate-dev --project=coupi-dev --location=asia-northeast3 --uniform-bucket-level-access
   ```

3. **gcloud 인증**

   ```bash
   gcloud auth application-default login
   ```

4. **Secret Manager에 실제 비밀값 입력** — `terraform apply`로 secret 컨테이너가 생긴 뒤에 수행한다

   ```bash
   echo -n "<DB 비밀번호>" | gcloud secrets versions add db-password --data-file=- --project=coupi-dev
   ```

   `gmail-oauth-client-secret`, `encryption-master-key`, `session-jwt-secret`도 같은 방식으로 넣는다.
   암호화 마스터 키 생성: `openssl rand -base64 32`

## 실행

```bash
cp envs/dev.tfvars.example envs/dev.tfvars
cp envs/dev.backend.hcl.example envs/dev.backend.hcl

terraform init -backend-config=envs/dev.backend.hcl
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

## 닭과 달걀 문제

`cloudsql.tf`의 `google_sql_user.app`이 `db-password` 시크릿 **값**을 읽는다. 즉 첫 apply는
시크릿 값이 없어 실패한다. 순서는 이렇다:

1. `terraform apply -target=google_secret_manager_secret.app` — 컨테이너만 먼저 생성
2. 위 `gcloud secrets versions add`로 값 입력
3. `terraform apply` — 전체 적용

첫 apply 때 이 순서를 문서대로 밟는지 확인하고, 필요하면 이 절을 수정한다.
