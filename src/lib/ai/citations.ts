/** A run of answer text, or a [p.N] citation the reader can actually click. */
export type AnswerPart =
  | { kind: "text"; text: string }
  | { kind: "citation"; text: string; page: number };

const CITATION = /\[p\.\s*(\d+)(?:\s*-\s*\d+)?\]/gi;

/**
 * Split an answer into text and citations. The model is told to cite as
 * [p.2]; anything that doesnt match stays plain text, so a malformed
 * citation is shown rather than swallowed.
 */
export function parseCitations(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let cursor = 0;

  for (const match of answer.matchAll(CITATION)) {
    const at = match.index;
    const page = Number.parseInt(match[1] ?? "", 10);
    if (at === undefined || !Number.isFinite(page) || page < 1) continue;

    if (at > cursor) {
      parts.push({ kind: "text", text: answer.slice(cursor, at) });
    }
    parts.push({ kind: "citation", text: match[0], page });
    cursor = at + match[0].length;
  }

  if (cursor < answer.length) {
    parts.push({ kind: "text", text: answer.slice(cursor) });
  }

  return parts;
}
