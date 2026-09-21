output "state_bucket" {
  description = "The bucket that stores Terraform's state. Use it in envs/prod/backend.hcl."
  value       = aws_s3_bucket.state.bucket
}
