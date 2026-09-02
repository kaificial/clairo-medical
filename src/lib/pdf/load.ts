import { extractDocument, fromPdfJsItems } from "./extract";
import type { ExtractedDocument, TextItem } from "./types";

/**
 * The slice of a pdf.js PDFDocumentProxy extraction needs
 */
export interface TextContentSource {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: readonly unknown[] }>;
  }>;
}

export interface LoadOptions {
  signal?: AbortSignal;
  onProgress?: (page: number, total: number) => void;
}

export async function pageTextItems(
  pdf: TextContentSource,
  pageNumber: number,
): Promise<TextItem[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  return fromPdfJsItems(content.items);
}

/** Read every page of a loaded PDF and then run layout aware extraction over it. */
export async function extractFromPdf(
  pdf: TextContentSource,
  options: LoadOptions = {},
): Promise<ExtractedDocument> {
  const total = Math.max(0, pdf.numPages);
  const pages: TextItem[][] = [];

  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    options.signal?.throwIfAborted();
    pages.push(await pageTextItems(pdf, pageNumber));
    options.onProgress?.(pageNumber, total);
  }

  return extractDocument(pages);
}
