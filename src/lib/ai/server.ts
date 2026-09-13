import "server-only";

import { google } from "@ai-sdk/google";
import { embedMany, streamText, type LanguageModel } from "ai";
import { z } from "zod";

import { env, usableModel } from "@/env";
import {
  jsonError,
  limitRequest,
  readJson,
  type LimitedRoute,
} from "@/lib/guard";

import { describeAiFailure } from "./failure";
import type { ChatPrompt } from "./prompt";
import { ANSWER_CONTENT_TYPE, toEventStream } from "./transport";

const chatModelName = usableModel(
  env.AI_CHAT_MODEL,
  env.GOOGLE_GENERATIVE_AI_API_KEY,
);
const embeddingModelName = usableModel(
  env.AI_EMBEDDING_MODEL,
  env.GOOGLE_GENERATIVE_AI_API_KEY,
);

/**
 * Whether the configured key covers the chat model. Chat, explain and AI lab
 * extraction all depend on it.
 */
export const chatEnabled = chatModelName !== null;
/**
 * Whether it covers the embedding model too. Only cloud semantic search needs
 * that.
 */
export const embeddingsEnabled = embeddingModelName !== null;

class AiNotConfiguredError extends Error {
  override name = "AiNotConfiguredError";

  constructor() {
    super(
      'No AI provider is configured for this feature. Set GOOGLE_GENERATIVE_AI_API_KEY and name a "google/*" model to switch it on.',
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

export function chatModel(): LanguageModel {
  if (chatModelName === null) throw new AiNotConfiguredError();
  return google(chatModelName);
}

export async function embedValues(values: string[]): Promise<number[][]> {
  if (embeddingModelName === null) throw new AiNotConfiguredError();

  const { embeddings } = await embedMany({
    model: google.embeddingModel(embeddingModelName),
    values,
  });
  return embeddings;
}

/**
 * Streams the chat model's reply as answer events, ending with an error event
 * if the provider gives up halfway.
 */
export function streamPrompt({ instructions, messages }: ChatPrompt): Response {
  // The AI SDK reports provider errors through onError and quietly ends the
  // text stream, so hold on to the error and send it as the last event.
  let failure: unknown;

  const result = streamText({
    model: chatModel(),
    instructions,
    messages,
    onError: ({ error }) => {
      failure = error;
      console.error("[ai] stream failed", error);
    },
  });

  const stream = toEventStream({
    deltas: result.textStream,
    describe: (cause) => describeAiFailure(cause).message,
    failure: () => failure,
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
