/**
 * Words carrying no signal in a medical report. Deliberately short: units,
 * numbers, and clinical shorthand all have to survive tokenisation.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

const MIN_LENGTH = 2;

/**
 * Strip a plural "s". Crude, but applied to queries and documents alike, so
 * "kidneys" still finds "kidney".
 */
function singular(word: string): string {
  if (word.length <= 3) return word;
  if (/(ss|us|is|as)$/.test(word)) return word;
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * Split text into comparable terms. Decimal numbers stay whole so a query for
 * a value like 6.1 can still match the row it came from.
 */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/\d+(?:\.\d+)?|[a-z]+/g) ?? [];

  return raw
    .filter((token) => token.length >= MIN_LENGTH && !STOP_WORDS.has(token))
    .map((token) => (/^\d/.test(token) ? token : singular(token)));
}
