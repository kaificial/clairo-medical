import { z } from "zod";

import {
  buildDefinitionPrompt,
  buildExactDefinitionPrompt,
} from "@/lib/ai/prompt";
import { aiRoute, chunkSchema, streamPrompt } from "@/lib/ai/server";

/**
 * Called when someone highlights a word in their report and asks what it means.
 * "explain" grounds the answer in the report passages that mention it. "exact"
 * skips the report entirely and gives the plain dictionary definition.
 */
export const POST = aiRoute({
  route: "define",
  maxBytes: 64_000,
  shape: "{ term, passages, mode? }",
  schema: z.object({
    term: z.string().trim().min(1).max(300),
    passages: z.array(chunkSchema).max(4),
    mode: z.enum(["explain", "exact"]).default("explain"),
  }),
  handle: ({ term, passages, mode }) =>
    streamPrompt(
      mode === "exact"
        ? buildExactDefinitionPrompt(term)
        : buildDefinitionPrompt({ term, passages }),
    ),
});
