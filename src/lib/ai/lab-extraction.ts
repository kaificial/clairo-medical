import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { groundModelRows, type GroundedRows } from "@/lib/labs";
import type { Chunk } from "@/lib/pdf";

import { buildLabPrompt } from "./prompt";

/**
 * Someone is watching a spinner while this runs. Gemini can be slow when it's
 * busy, but after 90 seconds it's better to say so and let them retry.
 */
const TIMEOUT_MS = 90_000;

/**
 * Everything comes back as text exactly as printed, even the numbers. Parsing
 * and judging values happens in our own code afterwards, so the model never
 * gets a say in what counts as normal.
 */
const labExtractionSchema = z.object({
  results: z.array(
    z.object({
      name: z.string().describe("The test name exactly as printed."),
      value: z
        .string()
        .describe('The result as printed, including any "<" or ">" sign.'),
      unit: z.string().nullable(),
      referenceRange: z
        .string()
        .nullable()
        .describe("The reference range printed beside this result, or null."),
      flag: z
        .string()
        .nullable()
        .describe('A printed marker such as "H", "L" or "*", or null.'),
      date: z.string().nullable(),
      page: z.number().int().describe("Page of the passage it came from."),
    }),
  ),
});

/**
 * Asks the model to list the results it can see, then keeps only the ones the
 * passages really contain. Models will happily invent a plausible looking
 * value, so nothing it says is trusted until it's been found on the page.
 */
export async function extractLabRows({
  model,
  passages,
  signal,
}: {
  model: LanguageModel;
  passages: readonly Chunk[];
  signal?: AbortSignal;
}): Promise<GroundedRows> {
  if (passages.length === 0) return { rows: [], discarded: 0 };

  const { instructions, messages } = buildLabPrompt(passages);
  const { output } = await generateText({
    model,
    instructions,
    messages,
    output: Output.object({ schema: labExtractionSchema }),
    maxRetries: 1,
    timeout: { totalMs: TIMEOUT_MS },
    abortSignal: signal,
  });

  return groundModelRows(output.results, passages);
}
