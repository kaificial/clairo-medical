import type { Block, ExtractedDocument } from "@/lib/pdf";
import type { LabStatus } from "@/lib/labs";

type PageBlock =
  | { kind: "heading"; text: string; level: number }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; rows: string[][] };

export const h = (text: string, level = 2): PageBlock => ({
  kind: "heading",
  text,
  level,
});
export const p = (text: string): PageBlock => ({ kind: "paragraph", text });
export const t = (...rows: string[][]): PageBlock => ({ kind: "table", rows });

export type QuestionKind = "lexical" | "paraphrase" | "section";

interface EvalQuestion {
  question: string;
  kind: QuestionKind;
  /**
   * Phrases that mark a chunk as a good answer, found in its text or its
   * headings.
   */
  relevant: string[];
}

interface GoldLab {
  name: string;
  value: number;
  status: LabStatus;
}

export interface EvalReport {
  id: string;
  title: string;
  document: ExtractedDocument;
  questions: EvalQuestion[];
  /**
   * Every result printed in the report's tables. Empty for reports without any,
   * like the CT and MRI.
   */
  labs: GoldLab[];
}

/**
 * Builds a document the way the extractor would, so the corpus can be written
 * as blocks instead of PDFs.
 */
export function pages(...content: PageBlock[][]): ExtractedDocument {
  return {
    pages: content.map((blocks, index) => {
      const page = index + 1;
      return {
        page,
        blocks: blocks.map((block): Block => {
          if (block.kind === "table") {
            return {
              kind: "table",
              page,
              rows: block.rows,
              text: block.rows.map((row) => row.join(" | ")).join("\n"),
            };
          }
          return { ...block, page };
        }),
      };
    }),
  };
}
