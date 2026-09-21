output "budget_name" {
  description = "The monthly budget. The kill switch in a later phase listens to it."
  value       = aws_budgets_budget.monthly.name
}
