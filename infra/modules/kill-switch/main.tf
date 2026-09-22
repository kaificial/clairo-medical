# Stops the website spending money on AWS once the month's budget is nearly
# gone, with no code of ours involved.
#
# How it works: when actual spend passes the threshold, AWS Budgets attaches
# the "pause" policy below to the website's role. That policy says no to every
# paid AI call, and a "no" beats any "yes" the role has elsewhere. The app
# already treats a refused call like any other failure and falls back to the
# next model, so readers keep getting answers from Gemini, which is billed by
# Google rather than AWS.
#
# At the start of the next month AWS takes the policy off again by itself.
#
# Budgets only sees new costs a few times a day, so spending can run a little
# past the threshold before the switch trips. That is why it trips below the
# full budget.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  account   = data.aws_caller_identity.current.account_id
  partition = data.aws_partition.current.partition
  role_arn  = "arn:${local.partition}:iam::${local.account}:role/${var.role_name}"
}

data "aws_iam_policy_document" "pause" {
  #checkov:skip=CKV_AWS_111:This policy only denies, so a wide resource takes power away rather than granting it.
  #checkov:skip=CKV_AWS_356:Same reason: a deny on every resource is the point of a kill switch.
  statement {
    sid    = "StopPaidCalls"
    effect = "Deny"
    actions = [
      "bedrock:*",
      "textract:*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "pause" {
  name        = "clairo-app-kill-switch"
  description = "Attached by AWS Budgets when the month's budget runs low. Blocks every paid AI call."
  policy      = data.aws_iam_policy_document.pause.json
}

# The role AWS Budgets uses to flip the switch. It can do exactly one thing:
# put the pause policy on the website's role, or take it off again.
data "aws_iam_policy_document" "budgets_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }

    # Only our own account's budgets may use it, so another AWS customer can't
    # trick the Budgets service into acting here.
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:${local.partition}:budgets::${local.account}:budget/${var.budget_name}"]
    }
  }
}

resource "aws_iam_role" "budgets" {
  name                 = "clairo-budget-actions"
  description          = "Used by AWS Budgets to pause Clairo's paid AI calls."
  assume_role_policy   = data.aws_iam_policy_document.budgets_trust.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "flip_the_switch" {
  statement {
    sid       = "AttachOnlyThePausePolicy"
    actions   = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
    resources = [local.role_arn]

    condition {
      test     = "ArnEquals"
      variable = "iam:PolicyARN"
      values   = [aws_iam_policy.pause.arn]
    }
  }
}

resource "aws_iam_role_policy" "flip_the_switch" {
  name   = "clairo-budget-actions"
  role   = aws_iam_role.budgets.name
  policy = data.aws_iam_policy_document.flip_the_switch.json
}

resource "aws_budgets_budget_action" "pause" {
  budget_name        = var.budget_name
  action_type        = "APPLY_IAM_POLICY"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budgets.arn

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = var.threshold_percent
  }

  definition {
    iam_action_definition {
      policy_arn = aws_iam_policy.pause.arn
      roles      = [var.role_name]
    }
  }

  dynamic "subscriber" {
    for_each = var.alert_emails

    content {
      address           = subscriber.value
      subscription_type = "EMAIL"
    }
  }

  # The role's permission has to exist before Budgets first checks it.
  depends_on = [aws_iam_role_policy.flip_the_switch]
}
