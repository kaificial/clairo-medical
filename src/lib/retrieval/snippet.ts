import { tokenize } from "./lexical";

const DEFAULT_LENGTH = 160;
const ELLIPSIS = "…";

/** The first position in `text` where any query term appears, or -1. */
function firstMatch(text: string, query: string): number {
  const haystack = text.toLowerCase();
  const positions = tokenize(query)
    .map((term) => haystack.indexOf(term))
    .filter((position) => position !== -1);
  return positions.length > 0 ? Math.min(...positions) : -1;
}

/**
 * A readable slice of a passage around the first matching word, for the search
 * results list. It snaps to word boundaries so a result never starts mid word.
 */
export function snippet(
  text: string,
  query: string,
  length = DEFAULT_LENGTH,
): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;

  const match = firstMatch(flat, query);
  if (match === -1) return `${flat.slice(0, length).trimEnd()}${ELLIPSIS}`;

  // Centre the window on the match, and slide it back if that would run past
  // the end of the text.
  let end = Math.min(
    flat.length,
    Math.max(0, match - Math.floor(length / 2)) + length,
  );
  let start = Math.max(0, end - length);

  if (start > 0) {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < match) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    if (space > start) end = space;
  }

  const prefix = start > 0 ? ELLIPSIS : "";
  const suffix = end < flat.length ? ELLIPSIS : "";
  return `${prefix}${flat.slice(start, end).trim()}${suffix}`;
}
