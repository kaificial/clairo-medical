terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.64"
    }
  }

  # The state lives in the bucket the bootstrap step made. Its name includes
  # the account number, so it is passed in at init time from backend.hcl:
  #   terraform init -backend-config=backend.hcl
  # use_lockfile makes S3 itself stop two runs from changing things at once.
  backend "s3" {
    key          = "clairo/prod.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
