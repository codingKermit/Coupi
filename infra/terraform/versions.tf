terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # 상태 파일은 GCS 버킷에 둔다. 버킷은 Terraform 바깥에서 한 번만 만든다
  # (상태를 담을 버킷을 상태로 관리할 수 없으므로 — infra/terraform/README.md 참고).
  backend "gcs" {
    # bucket / prefix는 backend-config로 주입한다:
    #   terraform init -backend-config=envs/dev.backend.hcl
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
