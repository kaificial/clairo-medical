/**
 * An answer comes apart into plain text and [p.N] citations, which become page
 * buttons.
 */
type AnswerPart =
  | { kind: "text"; text: string }
  | { kind: "citation"; text: string; page: number };

const CITATION = /\[p\.\s*(\d+)(?:\s*-\s*\d+)?\]/gi;

/**
 * The model is asked to cite pages as [p.2]. Anything that doesn't match that
 * form is left as plain text, so a slightly malformed citation still shows up
 * instead of silently vanishing from the answer.
 */
export function parseCitations(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let cursor = 0;

  for (const match of answer.matchAll(CITATION)) {
    const start = match.index;
    const page = Number(match[1]);
    if (start === undefined || page < 1) continue;

    if (start > cursor) {
      parts.push({ kind: "text", text: answer.slice(cursor, start) });
    }
    parts.push({ kind: "citation", text: match[0], page });
    cursor = start + match[0].length;
  }

  if (cursor < answer.length) {
    parts.push({ kind: "text", text: answer.slice(cursor) });
  }

  return parts;
}
