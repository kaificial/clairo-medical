export interface TextItem {
  str: string;
  /**
   * pdf.js transform matrix [a, b, c, d, e, f]
   * e is the x position and f the baseline y measured from the bottom of the page.
   */
  transform: readonly number[];
  width: number;
  height: number;
  fontName?: string;
}

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

interface HeadingBlock {
  kind: "heading";
  page: number;
  text: string;
  level: number;
}

interface ParagraphBlock {
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
