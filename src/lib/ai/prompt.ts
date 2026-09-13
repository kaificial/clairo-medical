import type { Chunk } from "@/lib/pdf";

/**
 * About ten passages' worth. Enough to answer from without sending most of a
 * long report with every question.
 */
const MAX_CONTEXT_CHARS = 12_000;
/** A definition only needs the passage or two that mention the term. */
const MAX_DEFINITION_CHARS = 4_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPrompt {
  instructions: string;
  messages: ChatMessage[];
}

/**
 * The rules for answering questions. Grounding comes first because the failure
 * that really matters here is a confident answer the report doesn't back up,
 * and for someone reading their own results that can be frightening.
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

export const DEFINITION_INSTRUCTIONS = [
  "Someone reading their own medical report highlighted a word or phrase and wants to know what it means.",
  "",
  "Rules:",
  "- Start with one sentence saying what the term means in plain language. Ordinary medical vocabulary is allowed here: this is a dictionary entry, not a summary of the report.",
  "- Then, only if the passages show the term in this report, add one sentence on how it appears there and cite the page as [p.2].",
  "- If the passages do not mention it, define the term and say the report does not say more about it.",
  "- Under 60 words in total. No lists, no headings, no preamble, no sign-off.",
  "- Expand abbreviations. Prefer everyday words to medical ones.",
  "- Say what a value or finding is. Do not say what it means for this reader's health, and never give a diagnosis, a prognosis, or treatment advice.",
  "- If the highlighted text is not a medical term, say plainly that there is nothing to define.",
].join("\n");

const LAB_INSTRUCTIONS = [
  "You extract laboratory test results from passages of someone's medical report.",
  "",
  "Rules:",
  "- Return one entry for every measured result: a named test with a numeric value. Results can sit in tables or in sentences.",
  "- Copy every field exactly as printed. Do not convert units, round, translate abbreviations, or fix typos.",
  "- If the same test appears on several dates, return each reading separately with its own date.",
  "- Use null for a unit, reference range, flag, or date the report does not print next to that result. Never supply a reference range from general knowledge.",
  "- page is the page number shown in the passage label.",
  "- Skip vital signs, medication doses, identifiers, phone numbers, ages, and scores that are not lab measurements.",
  "- Do not judge whether a value is normal. That is decided elsewhere.",
  "- If there are no lab results, return an empty list.",
].join("\n");

/**
 * How a passage is shown to the model: a number, the page (so it can cite it),
 * the section it sits under, then the text.
 */
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
 * Fits passages into the context budget. They arrive best match first, so when
 * something has to be cut it's the weakest match rather than whatever happened
 * to come last.
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

/**
 * The passages go in with the newest question, not in the instructions. A
 * follow up question usually needs different passages, and this way each turn
 * is grounded in what retrieval found for that turn.
 */
export function buildChatPrompt({
  question,
  passages,
  history = [],
}: {
  question: string;
  passages: readonly Chunk[];
  history?: readonly ChatMessage[];
}): ChatPrompt {
  const context = formatPassages(passages);
  const content =
    context.length > 0
      ? `Passages from the report:\n\n${context}\n\nQuestion: ${question}`
      : `No passages from the report matched this question.\n\nQuestion: ${question}`;

  return {
    instructions: CHAT_INSTRUCTIONS,
    messages: [...history, { role: "user", content }],
  };
}

export function buildDefinitionPrompt({
  term,
  passages,
}: {
  term: string;
  passages: readonly Chunk[];
}): ChatPrompt {
  const context = formatPassages(passages, MAX_DEFINITION_CHARS);
  const content =
    context.length > 0
      ? `Passages from the report:\n\n${context}\n\nHighlighted text: ${term}`
      : `This report has no passage containing the highlighted text.\n\nHighlighted text: ${term}`;

  return {
    instructions: DEFINITION_INSTRUCTIONS,
    messages: [{ role: "user", content }],
  };
}

export function buildLabPrompt(passages: readonly Chunk[]): ChatPrompt {
  return {
    instructions: LAB_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `Passages from the report:\n\n${formatPassages(passages)}`,
      },
    ],
  };
}
