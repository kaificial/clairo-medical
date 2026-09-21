import {
  createAmazonBedrock,
  type AmazonBedrockProvider,
} from "@ai-sdk/amazon-bedrock";
import { google } from "@ai-sdk/google";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import type { LanguageModel } from "ai";

import { env, type ModelChoice } from "@/env";

import type { NamedModel } from "./fallback";

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
}

type CredentialSource = () => Promise<AwsCredentials>;

/** Fetch new credentials this long before the old ones run out. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * Borrowed AWS credentials last about an hour. Without this, every AI request
 * would first make an extra round trip to AWS to borrow a fresh set.
 */
export function reuseUntilExpiry(
  source: CredentialSource,
  now: () => number = Date.now,
): CredentialSource {
  let current: Promise<AwsCredentials> | undefined;

  return async () => {
    const credentials = await current?.catch(() => undefined);
    const fresh =
      credentials !== undefined &&
      (credentials.expiration === undefined ||
        credentials.expiration.getTime() - now() > REFRESH_MARGIN_MS);
    if (fresh) return credentials;

    current = source();
    return current;
  };
}

/**
 * On Vercel the site proves who it is with a short lived signed note from
 * Vercel and borrows the clairo-app-web role, so no AWS key is stored
 * anywhere. On a laptop it uses whatever `aws sso login` left behind for
 * AWS_PROFILE.
 */
function awsCredentials(): CredentialSource {
  if (env.AWS_ROLE_ARN) {
    return awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN,
      clientConfig: { region: env.BEDROCK_REGION },
    });
  }
  return fromNodeProviderChain();
}

let bedrock: AmazonBedrockProvider | undefined;

function bedrockProvider(): AmazonBedrockProvider {
  bedrock ??= createAmazonBedrock({
    region: env.BEDROCK_REGION,
    credentialProvider: reuseUntilExpiry(awsCredentials()),
  });
  return bedrock;
}

export function languageModel(choice: ModelChoice): NamedModel {
  const model: LanguageModel =
    choice.provider === "bedrock"
      ? bedrockProvider()(choice.name)
      : google(choice.name);
  return { id: choice.id, model };
}
