# 서비스 계정 — 최소 권한 원칙 (docs/07-보안개인정보.md)

resource "google_service_account" "api" {
  account_id   = "coupi-api"
  display_name = "Coupi API 서비스"
}

resource "google_service_account" "worker" {
  account_id   = "coupi-worker"
  display_name = "Coupi 워커 서비스"
}

resource "google_service_account" "jobs" {
  account_id   = "coupi-jobs"
  display_name = "Coupi 배치 Job"
}

# Pub/Sub push와 Cloud Scheduler가 워커를 호출할 때 쓰는 신원
resource "google_service_account" "pubsub_invoker" {
  account_id   = "coupi-pubsub-invoker"
  display_name = "Pub/Sub → Cloud Run 호출자"
}

locals {
  # 서비스 계정별로 필요한 프로젝트 레벨 역할
  sa_roles = {
    "api" = {
      sa = google_service_account.api.email
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/pubsub.publisher",
        "roles/cloudtasks.enqueuer",
        "roles/cloudkms.cryptoKeyEncrypterDecrypter",
      ]
    }
    "worker" = {
      sa = google_service_account.worker.email
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/pubsub.publisher",
        "roles/cloudtasks.enqueuer",
        "roles/cloudkms.cryptoKeyEncrypterDecrypter",
      ]
    }
    "jobs" = {
      sa = google_service_account.jobs.email
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/pubsub.publisher",
      ]
    }
  }

  # {서비스계정키}-{역할} 조합을 평탄화
  sa_role_pairs = merge([
    for key, cfg in local.sa_roles : {
      for role in cfg.roles : "${key}:${role}" => {
        sa   = cfg.sa
        role = role
      }
    }
  ]...)
}

resource "google_project_iam_member" "sa_roles" {
  for_each = local.sa_role_pairs

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${each.value.sa}"
}

# Pub/Sub push 구독과 Scheduler가 워커 Cloud Run을 호출할 수 있게 한다.
resource "google_cloud_run_v2_service_iam_member" "pubsub_invokes_worker" {
  name     = google_cloud_run_v2_service.worker.name
  location = google_cloud_run_v2_service.worker.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

# API 서비스는 공개 — 모바일 앱이 호출한다.
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
