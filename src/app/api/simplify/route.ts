import { z } from "zod";

import { buildSimplifyPrompt } from "@/lib/ai/prompt";
import { aiRoute, streamPrompt } from "@/lib/ai/server";

/**
 * Rewrites an answer already on screen at a fifth grade reading level. The
 * model only ever sees that text, never the report itself.
 */
export const POST = aiRoute({
  route: "simplify",
  maxBytes: 16_000,
  shape: "{ text }",
  schema: z.object({
    text: z.string().trim().min(1).max(4_000),
  }),
  handle: ({ text }) => streamPrompt(buildSimplifyPrompt(text)),
});
