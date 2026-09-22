# Cloud Tasks 큐 — 지연 예약과 속도 제어가 필요한 작업 (docs/05)

resource "google_cloud_tasks_queue" "push_dispatch" {
  name     = "push-dispatch"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 50
    max_concurrent_dispatches = 50
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "10s"
    max_backoff        = "600s"
    max_doublings      = 4
  }

  depends_on = [google_project_service.enabled]
}

# 쿠폰 생성 시점에 schedule_time으로 예약한다 — 일일 전체 스캔 배치가 불필요해진다 (docs/05)
resource "google_cloud_tasks_queue" "coupon_expiry_reminder" {
  name     = "coupon-expiry-reminder"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 10
    max_concurrent_dispatches = 10
  }

  retry_config {
    max_attempts  = 3
    min_backoff   = "60s"
    max_backoff   = "3600s"
    max_doublings = 3
  }

  depends_on = [google_project_service.enabled]
}
