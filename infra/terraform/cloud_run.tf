# Cloud Run — API(공개)와 워커(내부 전용)를 분리 배포 (docs/05, docs/10)

locals {
  # 두 서비스가 공유하는 환경변수. 비밀값은 env가 아니라 secret으로 주입한다.
  common_env = {
    NODE_ENV                          = var.env == "prod" ? "production" : "development"
    GCP_PROJECT_ID                    = var.project_id
    GCP_LOCATION                      = var.region
    PUBSUB_TOPIC_MAIL_INGEST          = google_pubsub_topic.mail_ingest.name
    PUBSUB_TOPIC_COUPON_CLASSIFY      = google_pubsub_topic.coupon_classify.name
    CLOUD_TASKS_QUEUE_PUSH_DISPATCH   = google_cloud_tasks_queue.push_dispatch.name
    CLOUD_TASKS_QUEUE_EXPIRY_REMINDER = google_cloud_tasks_queue.coupon_expiry_reminder.name
  }

  secret_env = {
    GMAIL_OAUTH_CLIENT_SECRET = "gmail-oauth-client-secret"
    ENCRYPTION_MASTER_KEY     = "encryption-master-key"
    SESSION_JWT_SECRET        = "session-jwt-secret"
  }
}

resource "google_cloud_run_v2_service" "api" {
  name     = "coupi-api-${var.env}"
  location = var.region

  # 모바일 앱과 Gmail webhook이 호출하므로 공개 수신
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api.email

    scaling {
      # 요청이 없으면 0으로 내려간다 — 유휴 비용 없음 (docs/10)
      min_instance_count = 0
      max_instance_count = 10
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.api_image

      ports {
        container_port = 8080
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 6
      }
    }
  }

  depends_on = [google_project_service.enabled]
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "coupi-worker-${var.env}"
  location = var.region

  # Pub/Sub push와 Cloud Tasks만 호출한다 — 외부 직접 접근 차단 (docs/05)
  ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.worker.email

    scaling {
      min_instance_count = 0
      max_instance_count = 20
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.worker_image

      ports {
        container_port = 8080
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.enabled]
}
