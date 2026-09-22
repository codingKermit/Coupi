# 배치 — Cloud Scheduler가 Cloud Run Jobs를 호출한다 (docs/05)
#
# 만료 리마인더는 여기에 없다. 쿠폰 생성 시점에 Cloud Tasks schedule_time으로
# 예약하므로 일일 전체 스캔 배치가 필요 없다 (docs/05 "BullMQ 대비 달라지는 점").

locals {
  jobs = {
    "gmail-watch-renewal" = {
      args     = ["jobs/gmail-watch-renewal"]
      schedule = "0 0 * * *" # 매일 00:00 UTC — watch는 7일 후 만료 (docs/01)
    }
    "gmail-safety-poll" = {
      args     = ["jobs/gmail-safety-poll"]
      schedule = "0 */6 * * *" # 6시간마다 — webhook 유실 대비 보정 (docs/01)
    }
  }
}

resource "google_cloud_run_v2_job" "batch" {
  for_each = local.jobs

  name     = "coupi-${each.key}-${var.env}"
  location = var.region

  template {
    template {
      service_account = google_service_account.jobs.email

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image = var.worker_image
        args  = each.value.args

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
  }

  depends_on = [google_project_service.enabled]
}

resource "google_cloud_scheduler_job" "batch" {
  for_each = local.jobs

  name      = "coupi-${each.key}-${var.env}"
  region    = var.region
  schedule  = each.value.schedule
  time_zone = "Etc/UTC"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.batch[each.key].name}:run"

    oauth_token {
      service_account_email = google_service_account.jobs.email
    }
  }

  depends_on = [google_project_service.enabled]
}
