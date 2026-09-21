# Lets the website on Vercel use AWS without us storing any AWS password or key.
#
# It works like the GitHub setup next door. Whenever the site's server code
# runs, Vercel hands it a short lived signed note naming our team, the project,
# and whether this is production or a preview. AWS checks the signature and
# the note, then lends the code the clairo-app-web role for up to an hour.
#
# Today that role can do one thing: ask the chosen Claude models on Bedrock
# for an answer. It also wears the workload boundary, so even a mistake in its
# own policy could never give it more than the boundary allows.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  account   = data.aws_caller_identity.current.account_id
  partition = data.aws_partition.current.partition
  region    = data.aws_region.current.region

  issuer   = "oidc.vercel.com/${var.team_slug}"
  audience = "https://vercel.com/${var.team_slug}"

  # A "us." profile spreads calls over several US regions to dodge busy ones,
  # so the role needs the model itself in each of them as well as the profile.
  models = [for profile in var.inference_profiles : replace(profile, "/^(us|eu|apac)\\./", "")]
}

resource "aws_iam_openid_connect_provider" "vercel" {
  url            = "https://${local.issuer}"
  client_id_list = [local.audience]
}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.vercel.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.issuer}:aud"
      values   = [local.audience]
    }

    # Only this project, and only real deployments. Code running on someone's
    # laptop signs in with their own AWS login instead.
    condition {
      test     = "StringEquals"
      variable = "${local.issuer}:sub"
      values = [
        for environment in var.environments :
        "owner:${var.team_slug}:project:${var.project}:environment:${environment}"
      ]
    }
  }
}

resource "aws_iam_role" "web" {
  name                 = "clairo-app-web"
  description          = "Borrowed by the Clairo website on Vercel."
  assume_role_policy   = data.aws_iam_policy_document.trust.json
  permissions_boundary = var.boundary_arn
  max_session_duration = 3600
}

data "aws_iam_policy_document" "ask_the_models" {
  statement {
    sid = "AskTheChosenModels"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = concat(
      [
        for profile in var.inference_profiles :
        "arn:${local.partition}:bedrock:${local.region}:${local.account}:inference-profile/${profile}"
      ],
      [
        for model in local.models :
        "arn:${local.partition}:bedrock:*::foundation-model/${model}"
      ],
    )
  }
}

resource "aws_iam_role_policy" "ask_the_models" {
  name   = "clairo-app-web-bedrock"
  role   = aws_iam_role.web.name
  policy = data.aws_iam_policy_document.ask_the_models.json
}
