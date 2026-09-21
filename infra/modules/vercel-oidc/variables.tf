variable "team_slug" {
  description = "The Vercel team's short name, the part after vercel.com/ in the team's URL."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*$", var.team_slug))
    error_message = "Use the team's short name from its Vercel URL, such as my-team."
  }
}

variable "project" {
  description = "The Vercel project allowed to borrow the role."
  type        = string
}

variable "environments" {
  description = "Which Vercel deployments may borrow the role."
  type        = list(string)
  default     = ["production", "preview"]
}

variable "boundary_arn" {
  description = "The workload boundary the role must wear."
  type        = string
}

variable "inference_profiles" {
  description = "Bedrock inference profile ids the site may call, such as us.anthropic.claude-haiku-4-5-20251001-v1:0."
  type        = list(string)

  validation {
    condition     = alltrue([for profile in var.inference_profiles : can(regex("^(us|eu|apac)\\.", profile))])
    error_message = "Each entry must be a regional inference profile id starting with us., eu. or apac."
  }
}
