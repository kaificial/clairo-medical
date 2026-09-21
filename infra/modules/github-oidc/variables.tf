variable "repository" {
  description = "The GitHub repository allowed to use these roles, as owner/name."
  type        = string

  validation {
    condition     = can(regex("^[\\w.-]+/[\\w.-]+$", var.repository))
    error_message = "Write the repository as owner/name, for example kaificial/clairo-medical."
  }
}

variable "state_bucket" {
  description = "The bucket that holds Terraform's state, made by the bootstrap step."
  type        = string
}
