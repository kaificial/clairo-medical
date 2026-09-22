output "role_arn" {
  description = "Save in Vercel as the environment variable AWS_ROLE_ARN."
  value       = aws_iam_role.web.arn
}

output "role_name" {
  description = "The website's role, for anything that needs to adjust its permissions."
  value       = aws_iam_role.web.name
}
