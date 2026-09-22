# Clairo's cloud setup

This folder describes, in code, everything Clairo runs in Amazon Web Services
(AWS). Instead of clicking around a console and hoping to remember what was
changed, we write down what should exist, and a tool called Terraform makes AWS
match it. Every change is reviewed like any other code, and the whole thing can
be rebuilt or torn down with one command.

The website itself is hosted on Vercel. AWS only runs the pieces that are
cheapest or best there: the AI models, the scan pipeline, and the guard rails
around them.

## What it costs

About nothing while nobody is using it. Everything here is pay per use: you
are charged a fraction of a cent when someone asks a question or scans a page,
and nothing at all when they don't. There are deliberately no always-on
servers, load balancers, or network gateways, which are the usual sources of a
surprise bill.

## How it stays safe

- **A spending limit comes first.** Before anything else exists, a $10 monthly
  budget sends an email at $1, at $5, at $10, and as soon as the month looks
  on track to go over.
- **And it actually stops spending.** Emails alone don't stop a bill. Once $8
  has really been spent, AWS itself blocks the website's paid AI calls until
  the next month starts, and the app quietly falls back to Gemini. AWS only
  updates costs a few times a day, which is why it trips before the full $10.
- **No passwords or keys are stored anywhere.** GitHub proves who it is to AWS
  with a short lived signed note each time a workflow runs (this is called
  OIDC). There is nothing permanent that could leak.
- **A person approves every change.** Pull requests only preview what would
  change. Applying it needs someone to click approve.
- **Every app role has a ceiling.** Roles that the app's own pieces use must
  carry a permissions boundary, a fixed upper limit on what they could ever
  do, so no mistake can hand out more power than planned.
- **The keys to the building stay with a human.** CI is not allowed to change
  the GitHub roles, the boundary, or the trust between GitHub and AWS. Those
  changes are made by a person on their own machine.

## What is in here

| Folder                 | What it is                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `bootstrap/`           | Run once. Makes the private, versioned bucket where Terraform keeps its record of what exists. |
| `envs/prod/`           | The live setup. It lists which modules are switched on.                                        |
| `modules/budgets/`     | The spending limit and its warning emails.                                                     |
| `modules/github-oidc/` | The two GitHub roles (preview, and apply with approval) and the workload boundary.             |
| `modules/vercel-oidc/` | The role the website on Vercel borrows to ask Claude on Bedrock, again with no stored keys.    |
| `modules/kill-switch/` | Blocks the website's paid AI calls when the month's budget runs low, until the next month.     |

## First time setup

You need the [AWS CLI](https://aws.amazon.com/cli/) and
[Terraform](https://developer.hashicorp.com/terraform/install) 1.10 or newer.

1. **Create the AWS account** and turn on multi-factor sign-in for the root user.
   Then leave root alone: create a day to day admin user in IAM Identity Center
   and sign in with `aws configure sso`.
2. **Make the state bucket** (once, ever):

   ```bash
   terraform -chdir=infra/bootstrap init
   terraform -chdir=infra/bootstrap apply
   ```

   Note the `state_bucket` name it prints.

3. **Fill in your details.** In `infra/envs/prod`, copy `backend.hcl.example` to
   `backend.hcl` and `terraform.tfvars.example` to `terraform.tfvars`, then add
   the bucket name, your email, and your Vercel team's short name (the part
   after vercel.com/ in the team's URL). Both copies are ignored by git.
4. **Build the guard rails:**

   ```bash
   terraform -chdir=infra/envs/prod init -backend-config=backend.hcl
   terraform -chdir=infra/envs/prod plan
   terraform -chdir=infra/envs/prod apply
   ```

   Read the plan before typing yes. It should only list the budget, the GitHub
   roles, the boundary, and the Vercel role with its Bedrock permission.

5. **Confirm the budget emails.** AWS sends a confirmation link to each address.
6. **Connect GitHub.** In the repository settings, add the variables listed at
   the top of `.github/workflows/infra.yml` (including `VERCEL_TEAM_SLUG`), and
   create an environment called `production` with yourself as a required
   reviewer.
7. **Turn on Claude.** Bedrock now switches models on automatically, but
   Anthropic asks for a short use case form once per account. Open Claude
   Haiku 4.5 in the Bedrock model catalog (us-east-1) and submit it, then try
   it once in the playground.
8. **Connect Vercel.** Run `terraform -chdir=infra/envs/prod output vercel_role_arn`
   and save the value in the Vercel project as `AWS_ROLE_ARN`. Then set
   `AI_CHAT_MODEL` to list the models in the order to try them, for example
   `google/gemini-3.7-flash,bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0`.

## Day to day

Open a pull request that touches `infra/` and the workflow previews the change
against the real account. Merge it, approve the `production` deployment, and it
is applied. Changes to the GitHub roles, the boundary, the trust with GitHub
or Vercel, or the kill switch are the exception: apply those yourself with
step 4.

## Tearing it down

```bash
terraform -chdir=infra/envs/prod destroy
```

The state bucket is protected from accidental deletion. To remove it too,
delete the `prevent_destroy` line in `bootstrap/main.tf` first, empty the
bucket, then destroy the bootstrap stack.
