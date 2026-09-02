import type { Block, ExtractedDocument, TableBlock } from "./types";

const MAX_CHARS = 1200;
const OVERLAP_CHARS = 160;

/** A retrieval unit: enough text to answer from and also small enough to embed. */
export interface Chunk {
  id: string;
  text: string;
  page: number;
  endPage: number;
  headings: string[];
  kind: "prose" | "table";
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

interface HeadingFrame {
  level: number;
  text: string;
}

/** Trim to the last limit characters */
function tailOf(text: string, limit: number): string {
  if (limit <= 0) return "";
  if (text.length <= limit) return text;
  const tail = text.slice(text.length - limit);
  const space = tail.indexOf(" ");
  return space === -1 ? tail : tail.slice(space + 1);
}

/** Break an oversized paragraph when a sentence ends. */
function splitProse(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const units = text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [text];
  const parts: string[] = [];
  let current = "";

  for (const unit of units) {
    const piece = unit.trim();
    if (!piece) continue;

    if (piece.length > maxChars) {
      if (current) {
        parts.push(current);
        current = "";
      }
      for (const word of piece.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
          parts.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      continue;
    }

    const candidate = current ? `${current} ${piece}` : piece;
    if (candidate.length > maxChars) {
      parts.push(current);
      current = piece;
    } else {
      current = candidate;
    }
  }

  if (current) parts.push(current);
  return parts;
}

function rowText(row: readonly string[]): string {
  return row.join(" | ");
}

/**
 * Split a table on row boundaries, repeating the header row so every part
 * still says what its columns mean.
 */
function splitTable(block: TableBlock, maxChars: number): string[] {
  const [header, ...body] = block.rows;
  if (!header) return [];
  if (block.text.length <= maxChars) return [block.text];

  const headerLine = rowText(header);
  const parts: string[] = [];
  let lines: string[] = [headerLine];
  let length = headerLine.length;

  for (const row of body) {
    const line = rowText(row);
    if (lines.length > 1 && length + line.length + 1 > maxChars) {
      parts.push(lines.join("\n"));
      lines = [headerLine, line];
      length = headerLine.length + line.length + 1;
      continue;
    }
    lines.push(line);
    length += line.length + 1;
  }

  if (lines.length > 1 || parts.length === 0) parts.push(lines.join("\n"));
  return parts;
}

/** Drop heading frames at or below `level" then push the new one. */
function pushHeading(stack: HeadingFrame[], level: number, text: string) {
  while (stack.length > 0) {
    const top = stack.at(-1);
    if (!top || top.level < level) break;
    stack.pop();
  }
  stack.push({ level, text });
}

/**
 * Group blocks into overlapping heading aware chunks. Prose flows together up
 * to `maxChars"; tables stay whole unless they outgrow their own chunk
 */
export function toChunks(
  document: ExtractedDocument,
  options: ChunkOptions = {},
): Chunk[] {
  const maxChars = Math.max(1, options.maxChars ?? MAX_CHARS);
  const overlapChars = Math.max(
    0,
    Math.min(options.overlapChars ?? OVERLAP_CHARS, maxChars - 1),
  );

  const chunks: Chunk[] = [];
  const headings: HeadingFrame[] = [];
  const perPage = new Map<number, number>();

  let buffer = "";
  let bufferPage = 0;
  let bufferEndPage = 0;
  let bufferHeadings: string[] = [];

  function add(
    text: string,
    page: number,
    endPage: number,
    kind: Chunk["kind"],
    trail: string[],
  ) {
    const body = text.trim();
    if (!body) return;
    const ordinal = (perPage.get(page) ?? 0) + 1;
    perPage.set(page, ordinal);
    chunks.push({
      id: `p${page}#${ordinal}`,
      text: body,
      page,
      endPage,
      headings: trail,
      kind,
    });
  }

  function flush() {
    if (!buffer.trim()) {
      buffer = "";
      return;
    }
    add(buffer, bufferPage, bufferEndPage, "prose", bufferHeadings);
    buffer = "";
  }

  function appendProse(text: string, page: number) {
    const trail = headings.map((frame) => frame.text);

    for (const part of splitProse(text, maxChars)) {
      if (!buffer) {
        buffer = part;
        bufferPage = page;
        bufferEndPage = page;
        bufferHeadings = trail;
        continue;
      }

      if (buffer.length + part.length + 1 <= maxChars) {
        buffer = `${buffer} ${part}`;
        bufferEndPage = page;
        continue;
      }

      const carry = tailOf(buffer, overlapChars);
      flush();
      buffer = carry ? `${carry} ${part}` : part;
      bufferPage = page;
      bufferEndPage = page;
      bufferHeadings = trail;
    }
  }

  const blocks: Block[] = document.pages.flatMap((page) => page.blocks);

  for (const block of blocks) {
    if (block.kind === "heading") {
      flush();
      pushHeading(headings, block.level, block.text);
      continue;
    }

    if (block.kind === "table") {
      flush();
      const trail = headings.map((frame) => frame.text);
      for (const part of splitTable(block, maxChars)) {
        add(part, block.page, block.page, "table", trail);
      }
      continue;
    }

    appendProse(block.text, block.page);
  }

  flush();
  return chunks;
}
