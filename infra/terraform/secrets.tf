# Secret Manager — 비밀값 자체는 Terraform이 만들지 않는다.
# 컨테이너(secret)만 만들고, 실제 값은 사용자가 직접 넣는다
# (docs/10-기술스택결정.md "위임할 수 없는 작업").

locals {
  secret_ids = [
    "db-password",
    "gmail-oauth-client-secret",
    "encryption-master-key",
    "session-jwt-secret",
  ]
}

resource "google_secret_manager_secret" "app" {
  for_each = toset(local.secret_ids)

  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

# 값 주입은 사용자가 아래 명령으로 수행한다:
#   echo -n "<값>" | gcloud secrets versions add db-password --data-file=- --project=<PROJECT>
data "google_secret_manager_secret_version" "db_password" {
  secret     = google_secret_manager_secret.app["db-password"].secret_id
  depends_on = [google_secret_manager_secret.app]
}

# 애플리케이션 토큰 암호화용 KMS 키 (envelope encryption — docs/07)
resource "google_kms_key_ring" "main" {
  name       = "coupi-${var.env}"
  location   = var.region
  depends_on = [google_project_service.enabled]
}

resource "google_kms_crypto_key" "token_encryption" {
  name     = "token-encryption"
  key_ring = google_kms_key_ring.main.id

  rotation_period = "7776000s" # 90일

  lifecycle {
    prevent_destroy = true
  }
}
