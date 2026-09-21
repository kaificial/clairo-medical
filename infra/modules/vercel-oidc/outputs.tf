output "role_arn" {
  description = "Save in Vercel as the environment variable AWS_ROLE_ARN."
  value       = aws_iam_role.web.arn
}
