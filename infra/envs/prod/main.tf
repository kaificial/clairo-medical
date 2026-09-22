# Everything Clairo runs in AWS, gathered in one place. Each piece is a module,
# and this file is the list of which ones are switched on.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project     = "clairo"
      environment = "prod"
      managed_by  = "terraform"
    }
  }
}

# First, before anything that costs money: a spending limit with warnings.
module "budgets" {
  source = "../../modules/budgets"

  monthly_limit_usd      = var.monthly_budget_usd
  alert_emails           = var.alert_emails
  create_anomaly_monitor = var.create_anomaly_monitor
}

# Lets GitHub Actions preview and apply these changes without stored keys.
module "github_oidc" {
  source = "../../modules/github-oidc"

  repository   = var.github_repository
  state_bucket = var.state_bucket
}

# Lets the website on Vercel ask Claude on Bedrock for answers, again without
# stored keys.
module "vercel_oidc" {
  source = "../../modules/vercel-oidc"

  team_slug          = var.vercel_team_slug
  project            = var.vercel_project
  boundary_arn       = module.github_oidc.workload_boundary_arn
  inference_profiles = var.bedrock_inference_profiles
}

# When most of the month's budget is spent, AWS itself blocks the site's paid
# AI calls until the next month starts.
module "kill_switch" {
  source = "../../modules/kill-switch"

  budget_name       = module.budgets.budget_name
  role_name         = module.vercel_oidc.role_name
  threshold_percent = var.kill_switch_percent
  alert_emails      = var.alert_emails
}
