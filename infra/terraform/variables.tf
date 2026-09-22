variable "project_id" {
  description = "GCP 프로젝트 ID (환경별로 다름 — docs/05 '환경 분리')"
  type        = string
}

variable "env" {
  description = "환경 이름"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env는 dev 또는 prod만 허용한다 (staging은 3단계에서 추가 — docs/10)."
  }
}

variable "region" {
  description = "기본 리전"
  type        = string
  default     = "asia-northeast3"
}

variable "api_image" {
  description = "API 서비스 컨테이너 이미지. 최초 apply 시에는 플레이스홀더로 두고, CI가 실제 이미지로 갱신한다."
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "worker_image" {
  description = "워커 서비스 컨테이너 이미지"
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "db_tier" {
  description = "Cloud SQL 머신 타입. 고정비가 발생하는 유일한 리소스이므로 최소 사양으로 시작한다 (docs/10)."
  type        = string
  default     = "db-f1-micro"
}

variable "db_deletion_protection" {
  description = "prod에서는 반드시 true"
  type        = bool
  default     = true
}
