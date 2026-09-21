# A spending limit with early warnings. This is built before anything that can
# cost money, so a mistake shows up as an email long before it shows up as a
# bill.

resource "aws_budgets_budget" "monthly" {
  name         = "clairo-monthly"
  budget_type  = "COST"
  limit_amount = format("%.2f", var.monthly_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # One email for each warning level: a small amount spent, half the budget
  # spent, all of it spent, and the month on track to go over.
  dynamic "notification" {
    for_each = var.alerts

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.percent
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.forecast ? "FORECASTED" : "ACTUAL"
      subscriber_email_addresses = var.alert_emails
    }
  }
}

# AWS can also watch for spending that looks unusual for this account, like a
# service suddenly costing more than it ever has. New accounts often come with
# one of these already, and only one is allowed, so it is off unless asked for.
resource "aws_ce_anomaly_monitor" "services" {
  count = var.create_anomaly_monitor ? 1 : 0

  name              = "clairo-services"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "services" {
  count = var.create_anomaly_monitor ? 1 : 0

  name             = "clairo-unusual-spend"
  frequency        = "DAILY"
  monitor_arn_list = [aws_ce_anomaly_monitor.services[0].arn]

  dynamic "subscriber" {
    for_each = var.alert_emails

    content {
      type    = "EMAIL"
      address = subscriber.value
    }
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = [format("%.2f", var.anomaly_threshold_usd)]
    }
  }
}
