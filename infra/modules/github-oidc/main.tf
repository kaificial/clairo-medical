# Lets GitHub Actions work in AWS without us storing any AWS password or key.
#
# How it works, in plain terms: when a workflow runs, GitHub hands it a short
# lived signed note saying which repository and branch it is. AWS checks the
# signature, checks the note against the rules below, and lends the workflow a
# role for about an hour. Nothing long lived exists that could leak.
#
# There are two roles on purpose:
#   clairo-github-plan   can look at everything and preview changes. Used on
#                        every pull request.
#   clairo-github-apply  can make changes, but only from the "production"
#                        environment, which requires a person to approve.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  account   = data.aws_caller_identity.current.account_id
  partition = data.aws_partition.current.partition
  region    = data.aws_region.current.region

  state_bucket_arn = "arn:${local.partition}:s3:::${var.state_bucket}"
  boundary_arn     = "arn:${local.partition}:iam::${local.account}:policy/clairo-workload-boundary"
  workload_roles   = "arn:${local.partition}:iam::${local.account}:role/clairo-app-*"
  workload_policy  = "arn:${local.partition}:iam::${local.account}:policy/clairo-app-*"
  github_roles     = "arn:${local.partition}:iam::${local.account}:role/clairo-github-*"
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "trust" {
  for_each = {
    # Pull requests and the main branch may preview.
    plan = [
      "repo:${var.repository}:pull_request",
      "repo:${var.repository}:ref:refs/heads/main",
    ]
    # Only a job in the approved "production" environment may change things.
    apply = ["repo:${var.repository}:environment:production"]
  }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value
    }
  }
}

resource "aws_iam_role" "github" {
  for_each = data.aws_iam_policy_document.trust

  name                 = "clairo-github-${each.key}"
  assume_role_policy   = each.value.json
  max_session_duration = 3600
}

# Seeing how things are set up is fine. Reading what is stored in them is not:
# a preview never needs to open a scanned page or a job record.
resource "aws_iam_role_policy_attachment" "read_only" {
  for_each = aws_iam_role.github

  role       = each.value.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/ReadOnlyAccess"
}

data "aws_iam_policy_document" "no_data_reads" {
  statement {
    sid    = "DenyReadingStoredData"
    effect = "Deny"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "sqs:ReceiveMessage",
    ]
    # The one exception is Terraform's own state.
    not_resources = ["${local.state_bucket_arn}/*"]
  }
}

data "aws_iam_policy_document" "plan" {
  source_policy_documents = [data.aws_iam_policy_document.no_data_reads.json]

  # A preview still takes the state lock, so two runs never collide.
  statement {
    sid       = "UseTheStateLock"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_bucket_arn}/clairo/*.tflock"]
  }
}

resource "aws_iam_role_policy" "plan" {
  name   = "clairo-plan"
  role   = aws_iam_role.github["plan"].name
  policy = data.aws_iam_policy_document.plan.json
}

data "aws_iam_policy_document" "apply" {
  #checkov:skip=CKV_AWS_111:The only unscoped write is to Cost Explorer spending alerts, which AWS does not let us name one by one.
  #checkov:skip=CKV_AWS_356:Same reason: Cost Explorer alert actions only accept "*" as the resource.
  source_policy_documents = [data.aws_iam_policy_document.no_data_reads.json]

  statement {
    sid       = "ReadAndWriteState"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_bucket_arn}/clairo/*"]
  }

  statement {
    sid       = "ListState"
    actions   = ["s3:ListBucket"]
    resources = [local.state_bucket_arn]
  }

  statement {
    sid       = "ManageTheBudget"
    actions   = ["budgets:*"]
    resources = ["arn:${local.partition}:budgets::${local.account}:budget/clairo-*"]
  }

  # Cost Explorer does not support naming individual resources in a policy.
  statement {
    sid = "ManageSpendingAlerts"
    actions = [
      "ce:CreateAnomalyMonitor",
      "ce:UpdateAnomalyMonitor",
      "ce:DeleteAnomalyMonitor",
      "ce:CreateAnomalySubscription",
      "ce:UpdateAnomalySubscription",
      "ce:DeleteAnomalySubscription",
      "ce:TagResource",
      "ce:UntagResource",
    ]
    resources = ["*"]
  }

  # The role can create roles for the app's own pieces, but every one of them
  # must wear the workload boundary, a ceiling on what it could ever do. That
  # stops this role from quietly making a more powerful one.
  statement {
    sid = "CreateCappedWorkloadRoles"
    actions = [
      "iam:CreateRole",
      "iam:PutRolePermissionsBoundary",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
    ]
    resources = [local.workload_roles]

    condition {
      test     = "StringEquals"
      variable = "iam:PermissionsBoundary"
      values   = [local.boundary_arn]
    }
  }

  statement {
    sid = "LookAfterWorkloadRoles"
    actions = [
      "iam:DeleteRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PassRole",
    ]
    resources = [local.workload_roles]
  }

  statement {
    sid = "LookAfterWorkloadPolicies"
    actions = [
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:TagPolicy",
      "iam:UntagPolicy",
    ]
    resources = [local.workload_policy]
  }

  # Hands off the keys to the building. Changes to these roles, the boundary, or
  # the GitHub trust are made by a person on their own machine, never by CI.
  statement {
    sid     = "ProtectIdentity"
    effect  = "Deny"
    actions = ["iam:*"]
    resources = [
      local.github_roles,
      local.boundary_arn,
      aws_iam_openid_connect_provider.github.arn,
    ]
  }

  statement {
    sid       = "KeepBoundariesOn"
    effect    = "Deny"
    actions   = ["iam:DeleteRolePermissionsBoundary"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "apply" {
  name   = "clairo-apply"
  role   = aws_iam_role.github["apply"].name
  policy = data.aws_iam_policy_document.apply.json
}

# The ceiling every workload role lives under. A role can have less than this,
# never more. Each later phase adds only what its piece of the app needs.
data "aws_iam_policy_document" "boundary" {
  #checkov:skip=CKV_AWS_111:Textract and CloudWatch metrics do not support naming resources; metrics are held to our own namespace instead.
  #checkov:skip=CKV_AWS_356:Same reason: those two services only accept "*" as the resource.

  statement {
    sid = "WriteOurOwnLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:${local.partition}:logs:${local.region}:${local.account}:log-group:/aws/lambda/clairo-*",
      "arn:${local.partition}:logs:${local.region}:${local.account}:log-group:/aws/lambda/clairo-*:*",
      "arn:${local.partition}:logs:${local.region}:${local.account}:log-group:/clairo/*",
      "arn:${local.partition}:logs:${local.region}:${local.account}:log-group:/clairo/*:*",
    ]
  }

  statement {
    sid       = "PublishOurOwnMetrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["Clairo"]
    }
  }

  statement {
    sid = "AskTheModels"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      "arn:${local.partition}:bedrock:*::foundation-model/*",
      "arn:${local.partition}:bedrock:*:${local.account}:inference-profile/*",
    ]
  }

  statement {
    sid       = "ReadScannedPages"
    actions   = ["textract:AnalyzeDocument", "textract:DetectDocumentText"]
    resources = ["*"]
  }

  statement {
    sid = "UseClairoStorage"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "ssm:GetParameter",
      "ssm:PutParameter",
    ]
    resources = [
      "arn:${local.partition}:s3:::clairo-*/*",
      "arn:${local.partition}:dynamodb:${local.region}:${local.account}:table/clairo-*",
      "arn:${local.partition}:sqs:${local.region}:${local.account}:clairo-*",
      "arn:${local.partition}:ssm:${local.region}:${local.account}:parameter/clairo/*",
    ]
  }
}

resource "aws_iam_policy" "boundary" {
  name        = "clairo-workload-boundary"
  description = "The most any Clairo workload role may ever do."
  policy      = data.aws_iam_policy_document.boundary.json
}
