# Pub/Sub 토픽/구독 — docs/05-백엔드아키텍처.md "큐(Queue) 설계 상세"

# Gmail watch 알림이 발행되는 토픽. Gmail API 서비스 계정에 발행 권한을 줘야 한다.
resource "google_pubsub_topic" "gmail_notifications" {
  name       = "gmail-notifications"
  depends_on = [google_project_service.enabled]
}

# Gmail이 이 토픽에 발행할 수 있도록 권한 부여 (users.watch() 등록의 전제 조건)
resource "google_pubsub_topic_iam_member" "gmail_publisher" {
  topic  = google_pubsub_topic.gmail_notifications.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
}

resource "google_pubsub_topic" "mail_ingest" {
  name       = "mail-ingest"
  depends_on = [google_project_service.enabled]
}

resource "google_pubsub_topic" "coupon_classify" {
  name       = "coupon-classify"
  depends_on = [google_project_service.enabled]
}

# 재시도를 소진한 메시지가 모이는 곳. 여기에 메시지가 쌓이면 즉시 경보한다 (docs/08).
resource "google_pubsub_topic" "dead_letter" {
  name       = "dead-letter"
  depends_on = [google_project_service.enabled]
}

locals {
  push_subscriptions = {
    gmail-notifications = {
      topic = google_pubsub_topic.gmail_notifications.id
      path  = "/internal/gmail/webhook"
      # Gmail 알림은 계정 단위 순서가 중요하지 않다 (historyId로 재조회하므로)
      ordering = false
    }
    mail-ingest = {
      topic = google_pubsub_topic.mail_ingest.id
      path  = "/internal/mail-ingest"
      # 동일 계정 메시지의 순서 보장 — ordering key는 mailAccountId (docs/05)
      ordering = true
    }
    coupon-classify = {
      topic    = google_pubsub_topic.coupon_classify.id
      path     = "/internal/coupon-classify"
      ordering = false
    }
  }
}

resource "google_pubsub_subscription" "push" {
  for_each = local.push_subscriptions

  name  = "${each.key}-sub"
  topic = each.value.topic

  enable_message_ordering = each.value.ordering

  # 핸들러가 이 시간 안에 2xx를 반환하지 못하면 재전달된다 (docs/08 "ack 기한").
  ack_deadline_seconds = 60

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker.uri}${each.value.path}"

    # 워커는 내부 전용이므로 OIDC 토큰으로 인증한다 (docs/05 "내부 엔드포인트 보호").
    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}
