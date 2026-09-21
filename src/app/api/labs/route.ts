import { z } from "zod";

import { firstThatAnswers } from "@/lib/ai/fallback";
import { extractLabRows } from "@/lib/ai/lab-extraction";
import { aiRoute, chatModels, chunkSchema } from "@/lib/ai/server";
import { MAX_LAB_PASSAGES } from "@/lib/labs";

/**
 * For results the table parser can't see, like values written into sentences
 * ("serum lactate was elevated at 6.1"). The model's rows are checked against
 * the passages before anything goes back, so a value it made up never reaches
 * the reader.
 */
export const POST = aiRoute({
  route: "labs",
  maxBytes: 256_000,
  shape: "{ passages }",
  schema: z.object({
    passages: z.array(chunkSchema).min(1).max(MAX_LAB_PASSAGES),
  }),
  handle: async ({ passages }, request) =>
    Response.json(
      await firstThatAnswers(
        chatModels(),
        ({ model }) =>
          extractLabRows({ model, passages, signal: request.signal }),
        request.signal,
      ),
      { headers: { "cache-control": "no-store" } },
    ),
});
