"use client";

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  ScanText,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import { Button } from "@/components/ui/button";
import {
  extractDocument,
  readPageItems,
  recognisePages,
  scannedPages,
  type ExtractedDocument,
  type OcrProgress,
  type RenderableDocument,
  type TextContentSource,
  type TextItem,
} from "@/lib/pdf";
import { cn, pageList } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const STEP = 0.2;
const DEFAULT_SCALE = 1.1;

/**
 * Where we are in reading the PDF's text. This runs alongside rendering, so the
 * page shows up right away while lab results and search catch up.
 */
type Extraction =
  | { status: "idle" }
  | { status: "reading"; page: number; total: number }
  | {
      status: "ready";
      /**
       * Pages that turned out to be images with no text layer. They wait until
       * the reader opts in to OCR.
       */
      scanned: number[];
      /**
       * Pages we read with OCR, so the banner can warn that values might be
       * misread.
       */
      recognised: number[];
    }
  | { status: "ocr"; scanned: number[]; progress: OcrProgress | null }
  | { status: "ocr-error"; scanned: number[] }
  | { status: "error" };

type PdfSource = TextContentSource & RenderableDocument;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PdfViewer({
  file,
  className,
  page: requestedPage,
  onPageChange,
  onExtracted,
}: {
  file: string;
  className?: string;
  /**
   * Controlled from outside, so search results, citations and lab rows can all
   * jump to a page.
   */
  page: number;
  onPageChange: (page: number) => void;
  onExtracted: (document: ExtractedDocument) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [extraction, setExtraction] = useState<Extraction>({ status: "idle" });

  const extractionRef = useRef<AbortController | null>(null);
  const pdfRef = useRef<PdfSource | null>(null);
  const itemsRef = useRef<TextItem[][]>([]);

  useEffect(() => () => extractionRef.current?.abort(), []);

  /**
   * Starts a fresh text pass and cancels any that's still running, so an older
   * pass can't overwrite what this one finds.
   */
  function restart(): AbortController {
    extractionRef.current?.abort();
    const controller = new AbortController();
    extractionRef.current = controller;
    return controller;
  }

  async function readText(pdf: PdfSource) {
    const controller = restart();
    pdfRef.current = pdf;
    setExtraction({ status: "reading", page: 0, total: pdf.numPages });

    try {
      const items = await readPageItems(pdf, {
        signal: controller.signal,
        onProgress: (current, total) =>
          setExtraction({ status: "reading", page: current, total }),
      });
      if (controller.signal.aborted) return;

      itemsRef.current = items;
      setExtraction({
        status: "ready",
        scanned: scannedPages(items),
        recognised: [],
      });
      onExtracted(extractDocument(items));
    } catch {
      if (!controller.signal.aborted) setExtraction({ status: "error" });
    }
  }

  /**
   * Reads the scanned pages with OCR in the browser, then rebuilds the whole
   * document. Running headers are found by comparing pages, so the recognised
   * pages can't be processed on their own.
   */
  async function recognise(scanned: number[]) {
    const pdf = pdfRef.current;
    if (!pdf) return;

    const controller = restart();
    setExtraction({ status: "ocr", scanned, progress: null });

    try {
      const recognised = await recognisePages(pdf, scanned, {
        signal: controller.signal,
        onProgress: (progress) =>
          setExtraction({ status: "ocr", scanned, progress }),
      });
      if (controller.signal.aborted) return;

      const items = itemsRef.current.map(
        (pageItems, index) => recognised.get(index + 1) ?? pageItems,
      );
      itemsRef.current = items;
      setExtraction({
        status: "ready",
        scanned: [],
        recognised: [...recognised.keys()],
      });
      onExtracted(extractDocument(items));
    } catch {
      if (!controller.signal.aborted) {
        setExtraction({ status: "ocr-error", scanned });
      }
    }
  }

  const busy = status !== "ready";
  const last = numPages || 1;
  const page = clamp(requestedPage, 1, last);

  const goToPage = (next: number) => onPageChange(clamp(next, 1, last));
  const zoom = (delta: number) =>
    setScale((current) =>
      clamp(Math.round((current + delta) * 100) / 100, MIN_SCALE, MAX_SCALE),
    );

  const shortcuts: Record<string, () => void> = {
    ArrowRight: () => goToPage(page + 1),
    PageDown: () => goToPage(page + 1),
    ArrowLeft: () => goToPage(page - 1),
    PageUp: () => goToPage(page - 1),
    Home: () => goToPage(1),
    End: () => goToPage(last),
    "+": () => zoom(STEP),
    "=": () => zoom(STEP),
    "-": () => zoom(-STEP),
  };

  return (
    <div
      className={cn(
        "bg-muted/40 flex flex-col overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div className="bg-card/80 flex items-center justify-between gap-3 border-b px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Previous page"
            disabled={busy || page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft />
          </ToolbarButton>
          <span
            className="text-muted-foreground min-w-24 text-center font-mono text-xs tabular-nums"
            aria-live="polite"
          >
            {status === "ready" ? `${page} / ${numPages}` : "–"}
          </span>
          <ToolbarButton
            label="Next page"
            disabled={busy || page >= numPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight />
          </ToolbarButton>
        </div>

        <TextStatus extraction={extraction} />

        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Zoom out"
            disabled={busy || scale <= MIN_SCALE}
            onClick={() => zoom(-STEP)}
          >
            <Minus />
          </ToolbarButton>
          <span className="text-muted-foreground w-10 text-center font-mono text-xs tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <ToolbarButton
            label="Zoom in"
            disabled={busy || scale >= MAX_SCALE}
            onClick={() => zoom(STEP)}
          >
            <Plus />
          </ToolbarButton>
          <ToolbarButton
            label="Reset zoom"
            disabled={busy || scale === DEFAULT_SCALE}
            onClick={() => setScale(DEFAULT_SCALE)}
          >
            <RotateCcw />
          </ToolbarButton>
        </div>
      </div>

      <OcrBanner
        extraction={extraction}
        total={numPages}
        onRead={(scanned) => void recognise(scanned)}
      />

      <div
        role="region"
        aria-label={
          status === "ready"
            ? `Document, page ${page} of ${numPages}`
            : "Document"
        }
        tabIndex={0}
        onKeyDown={(event) => {
          const action = shortcuts[event.key];
          if (!action) return;
          event.preventDefault();
          action();
        }}
        className="focus-visible:ring-ring/50 flex flex-1 justify-center overflow-auto p-6 outline-none focus-visible:ring-2"
      >
        <Document
          file={file}
          onLoadSuccess={(pdf) => {
            setNumPages(pdf.numPages);
            setStatus("ready");
            void readText(pdf);
          }}
          onLoadError={() => setStatus("error")}
          loading={<ViewerMessage>Loading document...</ViewerMessage>}
          error={
            <ViewerMessage>
              This file could not be opened. It may be corrupt or not a PDF.
            </ViewerMessage>
          }
          className="h-max"
        >
          <Page
            pageNumber={page}
            scale={scale}
            renderAnnotationLayer={false}
            loading={<ViewerMessage>Rendering page...</ViewerMessage>}
            className="overflow-hidden rounded-lg border shadow-sm"
          />
        </Document>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-pill"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ocrProgressLabel(progress: OcrProgress | null): string {
  if (!progress || progress.stage === "loading") {
    return "Loading text recognition...";
  }
  const percent = Math.round(progress.progress * 100);
  return `Reading page ${progress.page} (${progress.index + 1} of ${progress.total}), ${percent}%`;
}

function OcrBanner({
  extraction,
  total,
  onRead,
}: {
  extraction: Extraction;
  total: number;
  onRead: (scanned: number[]) => void;
}) {
  const shell =
    "bg-card/60 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 text-xs";

  if (extraction.status === "ocr") {
    return (
      <div className={shell} role="status" aria-live="polite">
        <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
        <span className="text-muted-foreground">
          {ocrProgressLabel(extraction.progress)}
        </span>
      </div>
    );
  }

  if (extraction.status === "ready" && extraction.recognised.length > 0) {
    return (
      <div className={cn(shell, "text-muted-foreground")} role="status">
        <ScanText className="size-3.5" />
        Text on {pageList(extraction.recognised)} was read from the image on
        this device. OCR can misread, so check any value against the page.
      </div>
    );
  }

  const scanned =
    extraction.status === "ready" || extraction.status === "ocr-error"
      ? extraction.scanned
      : [];
  if (scanned.length === 0) return null;

  return (
    <div className={shell}>
      <ScanText className="text-muted-foreground size-3.5 shrink-0" />
      <span className="text-foreground font-medium">
        {scanned.length === total
          ? "This PDF is a scanned image, so it has no text to read yet."
          : `${pageList(scanned)} ${scanned.length === 1 ? "is a scanned image" : "are scanned images"}.`}
      </span>
      <Button
        variant="outline"
        size="xs"
        className="rounded-pill"
        onClick={() => onRead(scanned)}
      >
        Read the text on this device
      </Button>
      <span className="text-muted-foreground">
        Downloads a text recognition model once. The pages never leave your
        device.
      </span>
      {extraction.status === "ocr-error" ? (
        <span className="text-destructive" role="alert">
          Text recognition could not finish. Check your connection and try
          again.
        </span>
      ) : null}
    </div>
  );
}

function textStatus(extraction: Extraction): string | null {
  switch (extraction.status) {
    case "idle":
      return null;
    case "reading":
      return `Reading text ${extraction.page}/${extraction.total}`;
    case "ready":
      return extraction.scanned.length > 0 ? "No text layer" : "Text ready";
    case "ocr":
      return "Recognising text";
    default:
      return "Text unavailable";
  }
}

function TextStatus({ extraction }: { extraction: Extraction }) {
  const label = textStatus(extraction);
  if (label === null) return null;

  return (
    <span
      className="text-muted-foreground hidden text-xs sm:inline"
      role="status"
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function ViewerMessage({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground py-16 text-center text-sm">
      {children}
    </p>
  );
}
