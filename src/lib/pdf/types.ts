/** Shape of a pdf.js text item, narrowed to what extraction needs. */
export interface TextItem {
  str: string;
  /** pdf.js transform matrix [a, b, c, d, e, f]; e is x, f is baseline y. */
  transform: readonly number[];
  width: number;
  height: number;
  fontName?: string;
}

/** A run of text on one line, separated from its neighbours by a column gap. */
export interface Cell {
  text: string;
  x: number;
  width: number;
}

export interface Line {
  page: number;
  y: number;
  fontSize: number;
  cells: Cell[];
  text: string;
}

export interface HeadingBlock {
  kind: "heading";
  page: number;
  text: string;
  level: number;
}

export interface ParagraphBlock {
  kind: "paragraph";
  page: number;
  text: string;
}

export interface TableBlock {
  kind: "table";
  page: number;
  rows: string[][];
  text: string;
}

export type Block = HeadingBlock | ParagraphBlock | TableBlock;

export interface ExtractedPage {
  page: number;
  blocks: Block[];
}

export interface ExtractedDocument {
  pages: ExtractedPage[];
}
