output "pause_policy_arn" {
  description = "Detach this from clairo-app-web to turn paid AI back on before the month ends."
  value       = aws_iam_policy.pause.arn
}
