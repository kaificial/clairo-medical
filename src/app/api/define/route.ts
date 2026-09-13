import { z } from "zod";

import { buildDefinitionPrompt } from "@/lib/ai/prompt";
import { aiRoute, chunkSchema, streamPrompt } from "@/lib/ai/server";

/**
 * Called when someone highlights a word in their report and asks what it means.
 * We get the term and the few passages that mention it, nothing more.
 */
export const POST = aiRoute({
  route: "define",
  maxBytes: 64_000,
  shape: "{ term, passages }",
  schema: z.object({
    term: z.string().trim().min(1).max(300),
    passages: z.array(chunkSchema).max(4),
  }),
  handle: (body) => streamPrompt(buildDefinitionPrompt(body)),
});
