"use client";

import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import { Button } from "@/components/ui/button";
import { extractFromPdf } from "@/lib/pdf";
import type { ExtractedDocument, TextContentSource } from "@/lib/pdf";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const STEP = 0.2;
const DEFAULT_SCALE = 1.1;

type Status = "loading" | "ready" | "error";

/** Progress of the text pass that runs with rendering. */
export type Extraction =
  | { status: "idle" }
  | { status: "reading"; page: number; total: number }
  | { status: "ready"; document: ExtractedDocument }
  | { status: "error" };

export type PdfViewerProps = {
  file: string;
  className?: string;
  /** Page to show so search results can jump to a page. */
  page: number;
  onPageChange: (page: number) => void;
  onExtracted?: (document: ExtractedDocument) => void;
};

export function PdfViewerView({
  file,
  className,
  page: requestedPage,
  onPageChange,
  onExtracted,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [status, setStatus] = useState<Status>("loading");
  const [extraction, setExtraction] = useState<Extraction>({ status: "idle" });

  const extractionRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      extractionRef.current?.abort();
      extractionRef.current = null;
    },
    [],
  );

  async function readText(pdf: TextContentSource) {
    extractionRef.current?.abort();
    const controller = new AbortController();
    extractionRef.current = controller;

    setExtraction({ status: "reading", page: 0, total: pdf.numPages });

    try {
      const document = await extractFromPdf(pdf, {
        signal: controller.signal,
        onProgress: (current, total) =>
          setExtraction({ status: "reading", page: current, total }),
      });
      if (controller.signal.aborted) return;
      setExtraction({ status: "ready", document });
      onExtracted?.(document);
    } catch {
      if (!controller.signal.aborted) setExtraction({ status: "error" });
    }
  }

  const busy = status !== "ready";
  const last = numPages || 1;
  const page = Math.min(Math.max(1, requestedPage), last);

  const goToPage = useCallback(
    (next: number) => onPageChange(Math.min(Math.max(1, next), last)),
    [onPageChange, last],
  );

  const changePage = useCallback(
    (delta: number) => goToPage(page + delta),
    [goToPage, page],
  );

  const changeScale = useCallback(
    (delta: number) =>
      setScale((current) => {
        const next = Math.round((current + delta) * 100) / 100;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      }),
    [],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
        event.preventDefault();
        changePage(1);
        break;
      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();
        changePage(-1);
        break;
      case "Home":
        event.preventDefault();
        goToPage(1);
        break;
      case "End":
        event.preventDefault();
        goToPage(last);
        break;
      case "+":
      case "=":
        event.preventDefault();
        changeScale(STEP);
        break;
      case "-":
        event.preventDefault();
        changeScale(-STEP);
        break;
    }
  }

  return (
    <div
      className={cn(
        "bg-muted/40 flex flex-col overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div className="bg-card/80 flex items-center justify-between gap-3 border-b px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-pill"
            aria-label="Previous page"
            disabled={busy || page <= 1}
            onClick={() => changePage(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span
            className="text-muted-foreground min-w-24 text-center font-mono text-xs tabular-nums"
            aria-live="polite"
          >
            {status === "ready" ? `${page} / ${numPages}` : "–"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-pill"
            aria-label="Next page"
            disabled={busy || page >= numPages}
            onClick={() => changePage(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <TextStatus extraction={extraction} />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-pill"
            aria-label="Zoom out"
            disabled={busy || scale <= MIN_SCALE}
            onClick={() => changeScale(-STEP)}
          >
            <Minus className="size-4" />
          </Button>
          <span className="text-muted-foreground w-10 text-center font-mono text-xs tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-pill"
            aria-label="Zoom in"
            disabled={busy || scale >= MAX_SCALE}
            onClick={() => changeScale(STEP)}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-pill"
            aria-label="Reset zoom"
            disabled={busy || scale === DEFAULT_SCALE}
            onClick={() => setScale(DEFAULT_SCALE)}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      <div
        role="region"
        aria-label={
          status === "ready"
            ? `Document, page ${page} of ${numPages}`
            : "Document"
        }
        tabIndex={0}
        onKeyDown={onKeyDown}
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

function TextStatus({ extraction }: { extraction: Extraction }) {
  if (extraction.status === "idle") return null;

  const label =
    extraction.status === "reading"
      ? `Reading text ${extraction.page}/${extraction.total}`
      : extraction.status === "ready"
        ? "Text ready"
        : "Text unavailable";

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

function ViewerMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground py-16 text-center text-sm">
      {children}
    </p>
  );
}
