import type { ExtractedDocument, TableBlock } from "./types";

const MAX_CHARS = 1200;
const OVERLAP_CHARS = 160;
const SENTENCE = /[^.!?]+(?:[.!?]+|$)/g;

/**
 * A piece of the report for search and answers: big enough to answer from buut
 * small enough to embed well.
 */
export interface Chunk {
  id: string;
  text: string;
  page: number;
  endPage: number;
  headings: string[];
  kind: "prose" | "table";
}

interface HeadingFrame {
  level: number;
  text: string;
}

/** Prose collected so far for the chunk being built. */
interface ProseBuffer {
  text: string;
  page: number;
  endPage: number;
  headings: string[];
}

function tailOf(text: string, limit: number): string {
  if (limit <= 0) return "";
  if (text.length <= limit) return text;
  const tail = text.slice(text.length - limit);
  const space = tail.indexOf(" ");
  return space === -1 ? tail : tail.slice(space + 1);
}

/**
 * Breaks a paragraph thats too long for one chunk at the ends of sentences. A
 *  sentence longer than a whole chunk broken between words instead.
 */
function splitProse(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const parts: string[] = [];
  let current = "";

  function pack(piece: string) {
    const joined = current ? `${current} ${piece}` : piece;
    if (joined.length > maxChars && current) {
      parts.push(current);
      current = piece;
    } else {
      current = joined;
    }
  }

  for (const sentence of text.match(SENTENCE) ?? [text]) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (piece.length <= maxChars) {
      pack(piece);
      continue;
    }
    if (current) parts.push(current);
    current = "";
    piece.split(/\s+/).forEach(pack);
  }

  if (current) parts.push(current);
  return parts;
}

function rowText(row: readonly string[]): string {
  return row.join(" | ");
}

/**
 * Splits a big table between rows and repeats the header row in each part, so
 * every chunk still says what its columns mean.
 */
function splitTable(block: TableBlock, maxChars: number): string[] {
  const [header, ...body] = block.rows;
  if (!header) return [];
  if (block.text.length <= maxChars) return [block.text];

  const headerLine = rowText(header);
  const parts: string[] = [];
  let lines = [headerLine];
  let length = headerLine.length;

  for (const row of body) {
    const line = rowText(row);
    if (lines.length > 1 && length + line.length + 1 > maxChars) {
      parts.push(lines.join("\n"));
      lines = [headerLine];
      length = headerLine.length;
    }
    lines.push(line);
    length += line.length + 1;
  }

  if (lines.length > 1 || parts.length === 0) parts.push(lines.join("\n"));
  return parts;
}

/**
 * A new heading closes any open sections at the same level or deeper then
 * opens its own.
 */
function pushHeading(stack: HeadingFrame[], level: number, text: string) {
  while ((stack.at(-1)?.level ?? 0) >= level) stack.pop();
  stack.push({ level, text });
}

export function toChunks(
  document: ExtractedDocument,
  options: { maxChars?: number; overlapChars?: number } = {},
): Chunk[] {
  const maxChars = Math.max(1, options.maxChars ?? MAX_CHARS);
  const overlapChars = Math.max(
    0,
    Math.min(options.overlapChars ?? OVERLAP_CHARS, maxChars - 1),
  );

  const chunks: Chunk[] = [];
  const headings: HeadingFrame[] = [];
  const chunksPerPage = new Map<number, number>();
  let prose: ProseBuffer | null = null;

  const headingTrail = () => headings.map((frame) => frame.text);

  function emit(chunk: Omit<Chunk, "id">) {
    const text = chunk.text.trim();
    if (!text) return;

    const ordinal = (chunksPerPage.get(chunk.page) ?? 0) + 1;
    chunksPerPage.set(chunk.page, ordinal);
    chunks.push({ ...chunk, id: `p${chunk.page}#${ordinal}`, text });
  }

  function flush() {
    if (prose) emit({ ...prose, kind: "prose" });
    prose = null;
  }

  function appendProse(text: string, page: number) {
    for (const part of splitProse(text, maxChars)) {
      if (prose && prose.text.length + part.length + 1 <= maxChars) {
        prose.text = `${prose.text} ${part}`;
        prose.endPage = page;
        continue;
      }

      // Start the new chunk with the end of the last one so a sentence cut at
      // the boundary is still whole in one of them
      const carry = prose ? tailOf(prose.text, overlapChars) : "";
      flush();
      prose = {
        text: carry ? `${carry} ${part}` : part,
        page,
        endPage: page,
        headings: headingTrail(),
      };
    }
  }

  for (const block of document.pages.flatMap((page) => page.blocks)) {
    if (block.kind === "paragraph") {
      appendProse(block.text, block.page);
      continue;
    }

    flush();
    if (block.kind === "heading") {
      pushHeading(headings, block.level, block.text);
      continue;
    }

    const trail = headingTrail();
    for (const text of splitTable(block, maxChars)) {
      emit({
        text,
        page: block.page,
        endPage: block.page,
        headings: trail,
        kind: "table",
      });
    }
  }

  flush();
  return chunks;
}
