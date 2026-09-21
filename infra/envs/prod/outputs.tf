output "github_plan_role_arn" {
  description = "Save as the GitHub repository variable AWS_PLAN_ROLE_ARN."
  value       = module.github_oidc.plan_role_arn
}

output "github_apply_role_arn" {
  description = "Save as the GitHub repository variable AWS_APPLY_ROLE_ARN."
  value       = module.github_oidc.apply_role_arn
}

output "vercel_role_arn" {
  description = "Save in Vercel as the environment variable AWS_ROLE_ARN."
  value       = module.vercel_oidc.role_arn
}

output "budget_name" {
  value = module.budgets.budget_name
}
