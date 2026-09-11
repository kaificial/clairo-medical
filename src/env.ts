import { z } from "zod";

/**
 * Typed, validated environment access
 */

const CLIENT_PREFIX = "NEXT_PUBLIC_";

export class EnvValidationError extends Error {
  override name = "EnvValidationError";
}

export interface CreateEnvOptions<
  TServer extends z.ZodRawShape,
  TClient extends z.ZodRawShape,
> {
  /** Server only schema */
  server: z.ZodObject<TServer>;
  /** Client schema */
  client: z.ZodObject<TClient>;

  runtimeEnv: Record<string, string | undefined>;
  /**
   * Skip strict validation
   */
  skipValidation?: boolean;
  /** Override the client prefix */
  clientPrefix?: string;
}

export function createEnv<
  TServer extends z.ZodRawShape,
  TClient extends z.ZodRawShape,
>(
  opts: CreateEnvOptions<TServer, TClient>,
): Readonly<z.infer<z.ZodObject<TServer>> & z.infer<z.ZodObject<TClient>>> {
  type Result = Readonly<
    z.infer<z.ZodObject<TServer>> & z.infer<z.ZodObject<TClient>>
  >;

  const prefix = opts.clientPrefix ?? CLIENT_PREFIX;

  const misplacedClient = Object.keys(opts.client.shape).filter(
    (key) => !key.startsWith(prefix),
  );
  if (misplacedClient.length > 0) {
    throw new EnvValidationError(
      `Client env vars must be prefixed with "${prefix}": ${misplacedClient.join(", ")}`,
    );
  }

  const misplacedServer = Object.keys(opts.server.shape).filter((key) =>
    key.startsWith(prefix),
  );
  if (misplacedServer.length > 0) {
    throw new EnvValidationError(
      `Server env vars must not be prefixed with "${prefix}": ${misplacedServer.join(", ")}`,
    );
  }

  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(opts.runtimeEnv)) {
    normalized[key] =
      value === undefined || value.trim() === "" ? undefined : value;
  }

  const schema = z.object({ ...opts.server.shape, ...opts.client.shape });
  const parsed = schema.safeParse(normalized);

  if (parsed.success) {
    return Object.freeze(parsed.data) as Result;
  }

  if (opts.skipValidation === true) {
    console.warn(
      `[env] SKIP_ENV_VALIDATION set; using unvalidated environment:\n${z.prettifyError(parsed.error)}`,
    );
    return Object.freeze(normalized) as Result;
  }

  throw new EnvValidationError(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

function isFlagEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false";
}

export const modelIdSchema = z
  .string()
  .regex(
    /^[\w.-]+\/[\w.:-]+$/,
    'Expected a model id of the form "provider/model", such as "google/gemini-3.7-flash". This is not where an API key goes.',
  );

export const env = createEnv({
  server: z.object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    /** Google AI Studio key, called directly*/
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    AI_EMBEDDING_MODEL: modelIdSchema.default("google/gemini-embedding-001"),
    AI_CHAT_MODEL: modelIdSchema.default("google/gemini-3.7-flash"),
  }),
  client: z.object({}),
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    AI_EMBEDDING_MODEL: process.env.AI_EMBEDDING_MODEL,
    AI_CHAT_MODEL: process.env.AI_CHAT_MODEL,
  },
  skipValidation: isFlagEnabled(process.env.SKIP_ENV_VALIDATION),
});

/**
 * Every AI path checks whats configured rather than assume a key.
 */
export const providerKeys = {
  google: env.GOOGLE_GENERATIVE_AI_API_KEY !== undefined,
} as const;
