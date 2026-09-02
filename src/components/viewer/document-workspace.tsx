"use client";

import { FileText, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ExtractedDocument } from "@/lib/pdf";
import { cn } from "@/lib/utils";

import { PdfViewer } from "./pdf-viewer";

const MAX_BYTES = 25 * 1024 * 1024;

const SAMPLE = {
  name: "Example discharge summary",
  url: "/example-medical.pdf",
  local: false,
} as const;

interface Source {
  name: string;
  url: string;
  local: boolean;
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

/** Returns the problem with a dropped file, or null when its usable. */
function reject(file: File): string | null {
  if (!isPdf(file)) return "That file is not a PDF.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_BYTES) return "That PDF is larger than 25 MB.";
  return null;
}

function countSections(document: ExtractedDocument): number {
  return document.pages.reduce(
    (total, page) =>
      total + page.blocks.filter((block) => block.kind === "heading").length,
    0,
  );
}

export function DocumentWorkspace({ className }: { className?: string }) {
  const [source, setSource] = useState<Source | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    },
    [],
  );

  function open(next: Source) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = next.local ? next.url : null;
    setExtracted(null);
    setError(null);
    setSource(next);
  }

  function openFile(file: File) {
    const problem = reject(file);
    if (problem) {
      setError(problem);
      return;
    }
    open({ name: file.name, url: URL.createObjectURL(file), local: true });
  }

  function close() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setSource(null);
    setExtracted(null);
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
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate text-sm font-medium">
                {source.name}
              </span>
              {extracted ? (
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {extracted.pages.length} pages · {countSections(extracted)}{" "}
                  sections
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-pill"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                Open another
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-pill"
                aria-label="Close document"
                onClick={close}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <PdfViewer
            file={source.url}
            onExtracted={setExtracted}
            className="min-h-[70vh] flex-1"
          />
        </>
      ) : (
        <DropZone
          error={error}
          onFile={openFile}
          onError={setError}
          onBrowse={() => inputRef.current?.click()}
          onSample={() => open(SAMPLE)}
        />
      )}
    </div>
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
        if (event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (!file) {
          onError("That drop did not contain a file.");
          return;
        }
        onFile(file);
      }}
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-10 text-center transition-colors",
        dragging ? "border-primary bg-accent/40" : "bg-muted/30",
      )}
    >
      <Upload className="text-muted-foreground size-6" />
      <div className="space-y-1">
        <p className="font-serif text-xl tracking-tight">Open your report</p>
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
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
