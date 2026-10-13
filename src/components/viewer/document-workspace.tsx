"use client";

import { FileText, Upload, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { toChunks, type ExtractedDocument } from "@/lib/pdf";
import { cn } from "@/lib/utils";

import { InsightPanel } from "./insight-panel";
import { SearchPanel, useDocumentSearch } from "./search-panel";
import { SelectionExplainer } from "./selection-explainer";

/**
 * pdf.js reaches for the DOM and a web worker as soon as it loads, so the
 * viewer only ever renders in the browser.
 */
const PdfViewer = dynamic(
  () => import("./pdf-viewer").then((module) => module.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 shimmer flex min-h-[60vh] flex-1 items-center justify-center rounded-xl border">
        <p className="text-muted-foreground text-sm">Loading viewer...</p>
      </div>
    ),
  },
);

const MAX_MB = 25;

interface Source {
  name: string;
  url: string;
  /**
   * The same file always gets the same id, so reopening it finds the embeddings
   * saved last time instead of computing them again.
   */
  id: string;
}

const SAMPLE: Source = {
  name: "Example discharge summary",
  url: "/example-medical.pdf",
  id: "sample:example-medical",
};

/**
 * Checks a file before we try to open it, and returns the message to show when
 * it can't be used.
 */
function problemWith(file: File): string | null {
  const pdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!pdf) return "That file is not a PDF.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_MB * 1024 * 1024) {
    return `That PDF is larger than ${MAX_MB} MB.`;
  }
  return null;
}

export function DocumentWorkspace({
  aiEnabled,
  semanticEnabled,
  openExample,
  className,
}: {
  /**
   * Decided on the server from the configured key. Without a chat model the Ask
   * tab, the explain popover and AI lab extraction are simply not shown.
   */
  aiEnabled: boolean;
  /**
   * Cloud semantic search needs an embedding model too. On-device search works
   * either way.
   */
  semanticEnabled: boolean;
  /**
   * Opens the bundled sample straight away, for the landing page's "Try the
   * example" link.
   */
  openExample: boolean;
  className?: string;
}) {
  const [source, setSource] = useState<Source | null>(
    openExample ? SAMPLE : null,
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // A blob URL keeps the whole file in memory until it's revoked, so let go of
  // it as soon as that file is closed or replaced.
  useEffect(() => {
    const url = source?.url;
    return () => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [source]);

  function openFile(file: File) {
    const problem = problemWith(file);
    setError(problem);
    if (problem) return;

    setSource({
      name: file.name,
      url: URL.createObjectURL(file),
      id: `file:${file.name}:${file.size}`,
    });
  }

  function close() {
    setSource(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) openFile(file);
        }}
      />

      {source ? (
        <DocumentView
          key={source.url}
          source={source}
          aiEnabled={aiEnabled}
          semanticEnabled={semanticEnabled}
          onOpenAnother={() => inputRef.current?.click()}
          onClose={close}
        />
      ) : (
        <DropZone
          error={error}
          onFile={openFile}
          onError={setError}
          onBrowse={() => inputRef.current?.click()}
          onSample={() => {
            setError(null);
            setSource(SAMPLE);
          }}
        />
      )}
    </div>
  );
}

/**
 * Everything tied to one open document: its text, the current page, search
 * state. The parent keys it by file URL, so opening a different file throws all
 * of that away and starts clean.
 */
function DocumentView({
  source,
  aiEnabled,
  semanticEnabled,
  onOpenAnother,
  onClose,
}: {
  source: Source;
  aiEnabled: boolean;
  semanticEnabled: boolean;
  onOpenAnother: () => void;
  onClose: () => void;
}) {
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [page, setPage] = useState(1);
  const viewerRef = useRef<HTMLDivElement>(null);

  const chunks = useMemo(
    () => (extracted ? toChunks(extracted) : null),
    [extracted],
  );
  const { search, semantic, enableSemantic } = useDocumentSearch(
    source.id,
    chunks,
  );

  const sections = extracted?.pages.reduce(
    (total, { blocks }) =>
      total + blocks.filter((block) => block.kind === "heading").length,
    0,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="text-muted-foreground size-4 shrink-0" />
          <span className="truncate text-sm font-medium">{source.name}</span>
          {extracted ? (
            <span className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 shrink-0 font-mono text-xs motion-safe:duration-500">
              {extracted.pages.length} pages · {sections} sections
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-pill"
            onClick={onOpenAnother}
          >
            <Upload className="group-hover/button:-translate-y-0.5" />
            Open another
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-pill"
            aria-label="Close document"
            onClick={onClose}
          >
            <X className="group-hover/button:rotate-90" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SearchPanel
            search={search}
            semantic={semantic}
            cloudAvailable={semanticEnabled}
            onEnableSemantic={(engine) => void enableSemantic(engine)}
            onJump={setPage}
          />

          <div ref={viewerRef} className="relative flex flex-1 flex-col">
            <PdfViewer
              file={source.url}
              page={page}
              onPageChange={setPage}
              onExtracted={setExtracted}
              className="min-h-[70vh] flex-1"
            />

            {aiEnabled ? (
              <SelectionExplainer
                containerRef={viewerRef}
                chunks={chunks}
                search={search}
                onJump={setPage}
              />
            ) : null}
          </div>
        </div>

        <InsightPanel
          extracted={extracted}
          chunks={chunks}
          search={search}
          aiEnabled={aiEnabled}
          onJump={setPage}
          className="lg:sticky lg:top-24 lg:w-96 lg:shrink-0"
        />
      </div>
    </>
  );
}

function DropZone({
  error,
  onFile,
  onError,
  onBrowse,
  onSample,
}: {
  error: string | null;
  onFile: (file: File) => void;
  onError: (message: string) => void;
  onBrowse: () => void;
  onSample: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // dragleave also fires when the pointer moves onto a child element.
        // Only treat it as leaving once the pointer is really outside the drop
        // zone.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
        else onError("That drop did not contain a file.");
      }}
      className={cn(
        "group/drop relative isolate flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl p-10 text-center transition-colors duration-300",
        dragging ? "bg-accent/50" : "bg-muted/30 hover:bg-muted/50",
      )}
    >
      {/* Drawn as an SVG so the dashes can march round the edge while a file
          is held over the drop zone. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible"
      >
        <rect
          x="0.5"
          y="0.5"
          // rounded-xl is 22px; the stroke sits half a pixel inside it.
          rx="21.5"
          style={{ width: "calc(100% - 1px)", height: "calc(100% - 1px)" }}
          fill="none"
          strokeWidth={dragging ? 1.5 : 1}
          strokeDasharray="6 6"
          className={cn(
            "transition-[stroke] duration-300",
            dragging
              ? "stroke-foreground/60 motion-safe:animate-[dash-march_600ms_linear_infinite]"
              : "stroke-border group-hover/drop:stroke-foreground/30",
          )}
        />
      </svg>

      <span className="relative grid place-items-center">
        <span
          aria-hidden
          className={cn(
            "bg-highlight/60 absolute size-12 rounded-full transition-[scale,opacity] duration-500",
            dragging
              ? "scale-100 opacity-100 motion-safe:animate-ping"
              : "scale-50 opacity-0",
          )}
        />
        <span
          className={cn(
            "bg-card relative grid size-12 place-items-center rounded-full border shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            dragging
              ? "-translate-y-1.5 scale-110"
              : "motion-safe:animate-[float-y_3.2s_ease-in-out_infinite]",
          )}
        >
          <Upload className="text-muted-foreground size-5" />
        </span>
      </span>
      <div className="space-y-1">
        <p className="font-serif text-xl tracking-tight">
          {dragging ? "Let go to open it" : "Open your report"}
        </p>
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">
          Drop a PDF here, or choose one from your device
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button className="rounded-pill" onClick={onBrowse}>
          Choose a PDF
        </Button>
        <Button variant="ghost" className="rounded-pill" onClick={onSample}>
          Try the example
        </Button>
      </div>

      {error ? (
        <p
          key={error}
          className="text-destructive text-sm motion-safe:animate-[shake-x_400ms_ease-in-out]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
