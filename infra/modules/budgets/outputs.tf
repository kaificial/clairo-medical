output "budget_name" {
  description = "The monthly budget. The kill switch listens to it."
  value       = aws_budgets_budget.monthly.name
}
