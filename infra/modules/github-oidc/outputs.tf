output "plan_role_arn" {
  description = "Save as the GitHub repository variable AWS_PLAN_ROLE_ARN."
  value       = aws_iam_role.github["plan"].arn
}

output "apply_role_arn" {
  description = "Save as the GitHub repository variable AWS_APPLY_ROLE_ARN."
  value       = aws_iam_role.github["apply"].arn
}

output "workload_boundary_arn" {
  description = "Every role the app creates must use this as its permissions boundary."
  value       = aws_iam_policy.boundary.arn
}
