import "server-only";

import { google } from "@ai-sdk/google";
import { embedMany } from "ai";
import { z } from "zod";

import { configuredProviders, env, usableModel, usableModels } from "@/env";
import {
  jsonError,
  limitRequest,
  readJson,
  type LimitedRoute,
} from "@/lib/guard";

import { describeAiFailure } from "./failure";
import { streamFirstThatAnswers, type NamedModel } from "./fallback";
import type { ChatPrompt } from "./prompt";
import { languageModel } from "./providers";
import { ANSWER_CONTENT_TYPE, toEventStream } from "./transport";

const configured = configuredProviders(env);
const chatChoices = usableModels(env.AI_CHAT_MODEL, configured);
// Only Google embeddings are wired up, so a Bedrock login doesn't count here.
const embeddingChoice = usableModel(env.AI_EMBEDDING_MODEL, {
  google: configured.google,
});

/**
 * Whether at least one chat model can be reached. Chat, explain and AI lab
 * extraction all depend on it.
 */
export const chatEnabled = chatChoices.length > 0;
/**
 * Whether the embedding model can be reached too. Only cloud semantic search
 * needs that.
 */
export const embeddingsEnabled = embeddingChoice !== null;

class AiNotConfiguredError extends Error {
  override name = "AiNotConfiguredError";

  constructor() {
    super(
      'No AI provider is configured for this feature. Set GOOGLE_GENERATIVE_AI_API_KEY for "google/*" models, or AWS_ROLE_ARN (Vercel) or AWS_PROFILE (a laptop) for "bedrock/*" models.',
    );
  }
}

/**
 * Real chunks are about 1,200 characters. These caps leave plenty of room while
 * stopping anyone from posting a novel to a route that spends money.
 */
export const chunkSchema = z.object({
  id: z.string().max(64),
  text: z.string().max(8_000),
  page: z.number().int().positive().max(10_000),
  endPage: z.number().int().positive().max(10_000),
  headings: z.array(z.string().max(300)).max(12),
  kind: z.enum(["prose", "table"]),
});

export const historySchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8_000),
  }),
);

/** The chat models in the order to try them: the main one, then backups. */
export function chatModels(): NamedModel[] {
  if (!chatEnabled) throw new AiNotConfiguredError();
  return chatChoices.map(languageModel);
}

export async function embedValues(values: string[]): Promise<number[][]> {
  if (embeddingChoice === null) throw new AiNotConfiguredError();

  const { embeddings } = await embedMany({
    model: google.embeddingModel(embeddingChoice.name),
    values,
  });
  return embeddings;
}

/**
 * Streams the reply as answer events, from a backup model if the main one
 * fails before it starts, and ends with an error event if the answer breaks
 * off halfway.
 */
export async function streamPrompt(prompt: ChatPrompt): Promise<Response> {
  const { deltas, failure } = await streamFirstThatAnswers(
    chatModels(),
    prompt,
  );

  const stream = toEventStream({
    deltas,
    describe: (cause) => describeAiFailure(cause).message,
    failure,
  });

  return new Response(stream, {
    headers: {
      "content-type": ANSWER_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  });
}

/**
 * Builds the POST handler every AI route shares. The rate limit, size cap and
 * schema check all happen before the provider sees anything, and a failure
 * turns into a message the reader can act on. A 503 always means "not
 * configured", which is how the browser knows to hide a feature rather than
 * show an error.
 */
export function aiRoute<T>({
  route,
  schema,
  maxBytes,
  shape,
  handle,
}: {
  route: LimitedRoute;
  schema: z.ZodType<T>;
  maxBytes: number;
  shape: string;
  handle: (body: T, request: Request) => Response | Promise<Response>;
}) {
  return async function POST(request: Request): Promise<Response> {
    const limited = limitRequest(request, route);
    if (limited) return limited;

    const body = await readJson(request, schema, { maxBytes, shape });
    if (!body.ok) return body.response;

    try {
      return await handle(body.data, request);
    } catch (cause) {
      if (cause instanceof AiNotConfiguredError) {
        return jsonError(cause.message, 503);
      }

      console.error(`[${route}] request failed`, cause);
      const failure = describeAiFailure(cause);
      return jsonError(failure.message, failure.status);
    }
  };
}
