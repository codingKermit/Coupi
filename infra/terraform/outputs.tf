output "api_url" {
  description = "API 서비스 URL — 모바일 앱이 호출할 주소"
  value       = google_cloud_run_v2_service.api.uri
}

output "worker_url" {
  description = "워커 서비스 URL (내부 전용)"
  value       = google_cloud_run_v2_service.worker.uri
}

output "gmail_notifications_topic" {
  description = "users.watch() 등록 시 지정할 토픽 이름"
  value       = google_pubsub_topic.gmail_notifications.id
}

output "cloudsql_connection_name" {
  description = "Cloud SQL 커넥터 연결 이름"
  value       = google_sql_database_instance.main.connection_name
}
