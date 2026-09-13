import { z } from "zod";

import { aiRoute, embedValues } from "@/lib/ai/server";

const MAX_CHARS = 400_000;

/**
 * Only used when a reader picks cloud semantic search over the on-device model.
 * This is the one place report text is sent in bulk, so it runs because someone
 * clicked for it, never just because a file was opened.
 */
export const POST = aiRoute({
  route: "embed",
  maxBytes: MAX_CHARS * 3,
  shape: `{ values: string[] } with at most ${MAX_CHARS} characters in total`,
  schema: z.object({
    values: z
      .array(z.string().max(8_000))
      .min(1)
      .max(400)
      .refine(
        (values) =>
          values.reduce((total, value) => total + value.length, 0) <= MAX_CHARS,
      ),
  }),
  handle: async ({ values }) =>
    Response.json({ embeddings: await embedValues(values) }),
});
