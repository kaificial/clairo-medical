import { z } from "zod";

import { buildChatPrompt } from "@/lib/ai/prompt";
import {
  aiRoute,
  chunkSchema,
  historySchema,
  streamPrompt,
} from "@/lib/ai/server";

/**
 * Answers a reader's question about their report. The browser has already
 * searched the document and sends only the passages it found, so the file
 * itself never reaches this server.
 */
export const POST = aiRoute({
  route: "chat",
  maxBytes: 512_000,
  shape: "{ question, passages, history? }",
  schema: z.object({
    question: z.string().trim().min(1).max(2_000),
    passages: z.array(chunkSchema).max(12),
    history: historySchema.max(20).optional(),
  }),
  handle: (body) => streamPrompt(buildChatPrompt(body)),
});
