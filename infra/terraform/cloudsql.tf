# Cloud SQL (PostgreSQL) — 고정비가 발생하는 유일한 리소스 (docs/10)

resource "google_sql_database_instance" "main" {
  name             = "coupi-${var.env}"
  database_version = "POSTGRES_16"
  region           = var.region

  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL" # 초기 규모에서는 단일 인스턴스로 충분 (docs/05)
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.env == "prod"
      start_time                     = "18:00" # UTC — KST 03:00
    }

    ip_configuration {
      # 공개 IP를 열지 않고 Cloud SQL 커넥터로만 접속한다.
      ipv4_enabled = false
      # private_network 설정은 VPC 구성 후 추가한다.
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  depends_on = [google_project_service.enabled]
}

resource "google_sql_database" "coupi" {
  name     = "coupi"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "coupi_app"
  instance = google_sql_database_instance.main.name
  # 비밀번호는 Secret Manager에 사용자가 직접 넣고, 여기서는 참조만 한다.
  password = data.google_secret_manager_secret_version.db_password.secret_data
}
