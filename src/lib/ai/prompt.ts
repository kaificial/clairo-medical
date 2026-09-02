import type { Chunk } from "@/lib/pdf";

/** Cap on how much report text is sent with one question. */
export const MAX_CONTEXT_CHARS = 12_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * How Clairo is allowed to answer. The grounding rules come first because the
 * failure that matters here is a confident answer the report doesnt support.
 */
export const CHAT_INSTRUCTIONS = [
  "You help someone understand their own medical report. You are given numbered passages from that report.",
  "",
  "Rules:",
  "- Answer only from the passages provided. Never add facts from general knowledge, and never guess at a value that is not shown.",
  "- Cite the page for every claim, in the form [p.2]. Cite the page the passage came from.",
  "- If the passages do not answer the question, say so plainly and say what the report does cover.",
  "- Write in plain language for someone with no medical training. Short sentences. Expand abbreviations the first time you use them.",
  "- Report what a value says and whether the report itself flags it as abnormal. Do not interpret what it means for the reader's health.",
  "",
  "You are not a doctor and this is not a diagnosis. Do not give treatment advice, and do not predict how someone's illness will turn out.",
  "If the question is about prognosis, survival, or how serious something is, answer kindly: say the report cannot answer that, point to what it does say, and encourage them to ask the doctor who ordered it. Do not refuse coldly and do not lecture.",
].join("\n");

/** One passage as the model sees it: page, section -> then text. */
export function formatPassage(chunk: Chunk, index: number): string {
  const pages =
    chunk.endPage > chunk.page
      ? `p.${chunk.page}-${chunk.endPage}`
      : `p.${chunk.page}`;
  const section =
    chunk.headings.length > 0 ? ` · ${chunk.headings.join(" > ")}` : "";

  return `[${index + 1}] (${pages}${section})\n${chunk.text}`;
}

/**
 * Join passages under the context budget. Passages arrive best first, so
 * anything dropped is the weakest match compared to an arbitrary tail.
 */
export function formatPassages(
  chunks: readonly Chunk[],
  maxChars = MAX_CONTEXT_CHARS,
): string {
  const kept: string[] = [];
  let used = 0;

  for (const [index, chunk] of chunks.entries()) {
    const formatted = formatPassage(chunk, index);
    if (used + formatted.length > maxChars && kept.length > 0) break;

    kept.push(formatted);
    used += formatted.length;
  }

  return kept.join("\n\n");
}

export interface ChatPromptInput {
  question: string;
  passages: readonly Chunk[];
  history?: readonly ChatMessage[];
  maxChars?: number;
}

export interface ChatPrompt {
  instructions: string;
  messages: ChatMessage[];
}

/**
 * Build the request sent to the model. The passages ride with the newest
 * question rather than the instructions, so each turn is grounded in whatever
 * retrieval found for that turn.
 */
export function buildChatPrompt({
  question,
  passages,
  history = [],
  maxChars = MAX_CONTEXT_CHARS,
}: ChatPromptInput): ChatPrompt {
  const context = formatPassages(passages, maxChars);

  const content =
    context.length > 0
      ? `Passages from the report:\n\n${context}\n\nQuestion: ${question}`
      : `No passages from the report matched this question.\n\nQuestion: ${question}`;

  return {
    instructions: CHAT_INSTRUCTIONS,
    messages: [...history, { role: "user", content }],
  };
}
