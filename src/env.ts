import { z } from "zod";

const MODEL_ID = String.raw`[\w.-]+\/[\w.:-]+`;

export const modelIdSchema = z
  .string()
  .regex(
    new RegExp(`^${MODEL_ID}$`),
    'Expected a model id of the form "provider/model", such as "google/gemini-3.7-flash". This is not where an API key goes.',
  );

/**
 * One model, or several separated by commas. The first one answers and the
 * rest are backups, tried in order when the one before them fails.
 */
export const modelChainSchema = z
  .string()
  .regex(
    new RegExp(`^${MODEL_ID}(\\s*,\\s*${MODEL_ID})*$`),
    'Expected one or more "provider/model" ids separated by commas, such as "google/gemini-3.7-flash,bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0". This is not where an API key goes.',
  );

const schema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_CHAT_MODEL: modelChainSchema.default("google/gemini-3.7-flash"),
  AI_EMBEDDING_MODEL: modelIdSchema.default("google/gemini-embedding-001"),
  // On Vercel: the AWS role the site borrows through Vercel's signed login.
  AWS_ROLE_ARN: z
    .string()
    .regex(
      /^arn:aws[\w-]*:iam::\d{12}:role\/[\w+=,.@/-]+$/,
      "Expected an IAM role ARN, such as arn:aws:iam::123456789012:role/clairo-app-web.",
    )
    .optional(),
  // On a laptop: the AWS CLI profile you signed in with, such as "clairo".
  AWS_PROFILE: z.string().min(1).optional(),
  BEDROCK_REGION: z
    .string()
    .regex(
      /^[a-z]{2}(-[a-z]+)+-\d$/,
      "Expected an AWS region such as us-east-1.",
    )
    .default("us-east-1"),
});

type Env = z.infer<typeof schema>;

function isSet(flag: string | undefined): boolean {
  const value = flag?.trim().toLowerCase() ?? "";
  return value !== "" && value !== "0" && value !== "false";
}

/**
 * Reads and checks the environment at startup, and during the build through
 * next.config.ts. A blank line such as AI_CHAT_MODEL= in .env.local counts as
 * unset, so it falls back to the default instead of failing.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const values = Object.fromEntries(
    Object.keys(schema.shape).flatMap((key) => {
      const value = source[key]?.trim();
      return value ? [[key, value]] : [];
    }),
  );

  const parsed = schema.safeParse(values);
  if (parsed.success) return parsed.data;

  const message = `Invalid environment variables:\n${z.prettifyError(parsed.error)}`;
  if (!isSet(source.SKIP_ENV_VALIDATION)) throw new Error(message);

  console.warn(
    `[env] SKIP_ENV_VALIDATION is set, continuing anyway.\n${message}`,
  );
  return { ...schema.parse({}), ...values } as Env;
}

const PROVIDERS = ["google", "bedrock"] as const;

export type Provider = (typeof PROVIDERS)[number];

/** Which providers this server has a way to sign in to. */
export type ConfiguredProviders = Partial<Record<Provider, boolean>>;

export interface ModelChoice {
  /** The id as configured, such as "google/gemini-3.7-flash". */
  id: string;
  provider: Provider;
  /** The name that provider's SDK expects, such as "gemini-3.7-flash". */
  name: string;
}

export function configuredProviders(
  env: Pick<
    Env,
    "GOOGLE_GENERATIVE_AI_API_KEY" | "AWS_ROLE_ARN" | "AWS_PROFILE"
  >,
): Record<Provider, boolean> {
  return {
    google: Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY),
    bedrock: Boolean(env.AWS_ROLE_ARN || env.AWS_PROFILE),
  };
}

function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

/**
 * Splits "google/gemini-3.7-flash" into the provider and the name its SDK
 * expects, as long as the server can sign in to that provider. Anything else
 * returns null, which hides the feature in the UI rather than letting it fail
 * when someone tries it.
 */
export function usableModel(
  modelId: string,
  configured: ConfiguredProviders,
): ModelChoice | null {
  const [provider = "", ...rest] = modelId.split("/");
  const name = rest.join("/");
  if (!name || !isProvider(provider) || !configured[provider]) return null;
  return { id: modelId, provider, name };
}

/**
 * The usable models from a comma separated list, in order. Ones the server
 * can't sign in to are skipped, so the same setting works on a laptop with
 * only a Google key and on Vercel with both providers.
 */
export function usableModels(
  chain: string,
  configured: ConfiguredProviders,
): ModelChoice[] {
  return chain
    .split(",")
    .map((id) => id.trim())
    .flatMap((id) => usableModel(id, configured) ?? []);
}

export const env = parseEnv(process.env);
