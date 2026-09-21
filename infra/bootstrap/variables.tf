variable "region" {
  description = "The AWS region for everything Clairo runs. us-east-1 has every service we use, including Bedrock."
  type        = string
  default     = "us-east-1"
}
