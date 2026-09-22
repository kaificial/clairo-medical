variable "budget_name" {
  description = "The monthly budget that trips the switch."
  type        = string
}

variable "role_name" {
  description = "The website's role, which gets the pause policy when the switch trips."
  type        = string
}

variable "threshold_percent" {
  description = "How much of the budget, in percent, may be spent before paid AI calls stop."
  type        = number
  default     = 80

  validation {
    condition     = var.threshold_percent > 0 && var.threshold_percent <= 100
    error_message = "Pick a percentage above 0 and at most 100."
  }
}

variable "alert_emails" {
  description = "Who hears when the switch trips."
  type        = list(string)
}
