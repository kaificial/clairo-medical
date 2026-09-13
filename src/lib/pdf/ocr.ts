import type { TextItem } from "./types";

const MIN_WORD_CONFIDENCE = 35;
const SCANNED_PAGE_CHARS = 12;
const RENDER_SCALE = 2;

interface PixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrLine {
  words: { text: string; confidence: number; bbox: PixelBox }[];
  bbox: PixelBox;
}

export function scannedPages(pages: readonly TextItem[][]): number[] {
  return pages.flatMap((items, index) => {
    const characters = items.reduce(
      (sum, item) => sum + item.str.replace(/\s+/g, "").length,
      0,
    );
    return characters < SCANNED_PAGE_CHARS ? [index + 1] : [];
  });
}

export function ocrToTextItems(
  lines: readonly OcrLine[],
  {
    scale,
    pageHeight,
  }: {
    /** Pixels per PDF unit the page was rendered at. */
    scale: number;
    /** Page height in PDF units to flip OCRs y axis into PDF's. */
    pageHeight: number;
  },
): TextItem[] {
  const items: TextItem[] = [];

  for (const line of lines) {
    const height = (line.bbox.y1 - line.bbox.y0) / scale;
    if (height <= 0) continue;
    const baseline = pageHeight - line.bbox.y1 / scale;

    for (const word of line.words) {
      const text = word.text.trim();
      if (!text || word.confidence < MIN_WORD_CONFIDENCE) continue;

      items.push({
        str: text,
        transform: [height, 0, 0, height, word.bbox.x0 / scale, baseline],
        width: (word.bbox.x1 - word.bbox.x0) / scale,
        height,
      });
    }
  }

  return items;
}

/** The slice of a pdf.js page that rendering to a canvas */
interface RenderablePage {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<unknown> };
}

export interface RenderableDocument {
  getPage(pageNumber: number): Promise<unknown>;
}

export type OcrProgress =
  | { stage: "loading"; progress: number }
  | {
      stage: "reading";
      page: number;
      index: number;
      total: number;
      progress: number;
    };

export async function recognisePages(
  pdf: RenderableDocument,
  pages: readonly number[],
  {
    signal,
    onProgress,
  }: {
    signal?: AbortSignal;
    onProgress?: (progress: OcrProgress) => void;
  } = {},
): Promise<Map<number, TextItem[]>> {
  const { createWorker } = await import("tesseract.js");

  let current: { page: number; index: number } | null = null;
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (current && message.status === "recognizing text") {
        onProgress?.({
          stage: "reading",
          ...current,
          total: pages.length,
          progress: message.progress,
        });
      } else if (!current) {
        onProgress?.({ stage: "loading", progress: message.progress });
      }
    },
  });

  const recognised = new Map<number, TextItem[]>();

  try {
    for (const [index, pageNumber] of pages.entries()) {
      signal?.throwIfAborted();
      current = { page: pageNumber, index };

      const page = (await pdf.getPage(pageNumber)) as RenderablePage;
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available for OCR.");

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines),
      );

      recognised.set(
        pageNumber,
        ocrToTextItems(lines, {
          scale: RENDER_SCALE,
          pageHeight: page.getViewport({ scale: 1 }).height,
        }),
      );
    }
  } finally {
    await worker.terminate();
  }

  return recognised;
}
