variable "monthly_limit_usd" {
  description = "The most Clairo should ever spend in a month, in US dollars."
  type        = number

  validation {
    condition     = var.monthly_limit_usd > 0
    error_message = "The monthly limit has to be more than zero."
  }
}

variable "alert_emails" {
  description = "Who gets the warning emails. AWS sends each address a confirmation link first."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "Give at least one email address, or nobody hears about spending."
  }
}

variable "alerts" {
  description = "When to send a warning, as a percentage of the monthly limit. forecast means the month is on track to pass it, not that it already has."
  type = list(object({
    percent  = number
    forecast = bool
  }))
  default = [
    { percent = 10, forecast = false },
    { percent = 50, forecast = false },
    { percent = 100, forecast = false },
    { percent = 100, forecast = true },
  ]
}

variable "create_anomaly_monitor" {
  description = "Also watch for unusual spending. Leave this off if the account already has a services monitor, since AWS allows only one."
  type        = bool
  default     = false
}

variable "anomaly_threshold_usd" {
  description = "How big an unusual charge has to be, in dollars, before it is worth an email."
  type        = number
  default     = 1
}
