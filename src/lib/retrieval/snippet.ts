import { tokenize } from "./tokenize";

const DEFAULT_LENGTH = 160;
const ELLIPSIS = "…";

/** First position in `text` where any query term appears, or -1. */
function firstMatch(text: string, query: string): number {
  const haystack = text.toLowerCase();

  let earliest = -1;
  for (const term of tokenize(query)) {
    const at = haystack.indexOf(term);
    if (at !== -1 && (earliest === -1 || at < earliest)) earliest = at;
  }

  return earliest;
}

/**
 * A readable window of `text` around the first query term, snapped to word
 * boundaries so a result never opens mid-word.
 */
export function snippet(
  text: string,
  query: string,
  length = DEFAULT_LENGTH,
): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;

  const at = firstMatch(flat, query);
  if (at === -1) return `${flat.slice(0, length).trimEnd()}${ELLIPSIS}`;

  const half = Math.floor(length / 2);
  let start = Math.max(0, at - half);
  let end = Math.min(flat.length, start + length);
  start = Math.max(0, end - length);

  if (start > 0) {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    if (space > start) end = space;
  }

  return `${start > 0 ? ELLIPSIS : ""}${flat.slice(start, end).trim()}${
    end < flat.length ? ELLIPSIS : ""
  }`;
}
