import { z } from "zod";

export const modelIdSchema = z
  .string()
  .regex(
    /^[\w.-]+\/[\w.:-]+$/,
    'Expected a model id of the form "provider/model", such as "google/gemini-3.7-flash". This is not where an API key goes.',
  );

const schema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_CHAT_MODEL: modelIdSchema.default("google/gemini-3.7-flash"),
  AI_EMBEDDING_MODEL: modelIdSchema.default("google/gemini-embedding-001"),
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

/**
 * Turns "google/gemini-3.7-flash" into the name the Google SDK expects, as long
 * as there's a key to use it with. Anything else returns null, which hides the
 * feature in the UI rather than letting it fail when someone tries it.
 */
export function usableModel(
  modelId: string,
  apiKey: string | undefined,
): string | null {
  const [provider, ...name] = modelId.split("/");
  return apiKey && provider === "google" && name.length > 0
    ? name.join("/")
    : null;
}

export const env = parseEnv(process.env);
