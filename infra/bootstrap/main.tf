# Terraform keeps a record of everything it has built, called the state. This
# one-time step makes a private bucket to hold that record, so it lives in AWS
# instead of on one laptop. It runs once, by hand, before anything else.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project    = "clairo"
      managed_by = "terraform"
      stack      = "bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "state" {
  # These four extras are for buckets holding data many people rely on. For one
  # small, private, versioned state file they add cost and a second bucket
  # without making it meaningfully safer.
  #checkov:skip=CKV_AWS_18:Access logs would need a second bucket; CloudTrail already records who touched this one.
  #checkov:skip=CKV_AWS_144:A copy in another region doubles storage for a file that versioning already protects.
  #checkov:skip=CKV_AWS_145:A customer managed KMS key costs a dollar a month; S3's own encryption is on.
  #checkov:skip=CKV2_AWS_62:Nothing needs to react when the state file changes.

  # Bucket names are global across all of AWS, so the account number keeps ours
  # unique.
  bucket = "clairo-tfstate-${data.aws_caller_identity.current.account_id}"

  # Losing the state would mean Terraform forgets what it built. Refuse to
  # delete this bucket unless someone removes this line on purpose.
  lifecycle {
    prevent_destroy = true
  }
}

# Every change to the state is kept as a new version, so a bad run can be
# rolled back.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Old versions are only useful for a while. After 90 days they are deleted so
# storage never quietly grows.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Refuse any request that isn't encrypted in transit.
data "aws_iam_policy_document" "state" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json
}
