variable "region" {
  description = "The AWS region for everything Clairo runs."
  type        = string
  default     = "us-east-1"
}

variable "monthly_budget_usd" {
  description = "The most Clairo should spend in a month. Warnings go out well before it."
  type        = number
  default     = 10
}

variable "alert_emails" {
  description = "Who hears about spending."
  type        = list(string)
}

variable "create_anomaly_monitor" {
  description = "Also email about unusual spending. Leave off if the account already has a services monitor."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "The repository whose workflows may use AWS, as owner/name."
  type        = string
  default     = "kaificial/clairo-medical"
}

variable "state_bucket" {
  description = "The state bucket from the bootstrap step. The same name goes in backend.hcl."
  type        = string
}

variable "vercel_team_slug" {
  description = "The Vercel team's short name, the part after vercel.com/ in the team's URL."
  type        = string
}

variable "vercel_project" {
  description = "The Vercel project that hosts the site."
  type        = string
  default     = "clairo-medical"
}

variable "bedrock_inference_profiles" {
  description = "The Claude models on Bedrock the site may call."
  type        = list(string)
  default     = ["us.anthropic.claude-haiku-4-5-20251001-v1:0"]
}
