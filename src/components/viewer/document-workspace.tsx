"use client";

import { FileText, Search, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AiUnavailableError, embedViaApi } from "@/lib/ai";
import { toChunks, type ExtractedDocument } from "@/lib/pdf";
import {
  createRetrievalService,
  denseStrategy,
  indexDocument,
  lexicalStrategy,
  snippet,
  type RetrievalHit,
} from "@/lib/retrieval";
import { cn } from "@/lib/utils";
import { createIndexedDbVectorStore } from "@/lib/vector";

import { ChatPanel } from "./chat-panel";
import { PdfViewer } from "./pdf-viewer";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_RESULTS = 5;

const SAMPLE = {
  name: "Example discharge summary",
  url: "/example-medical.pdf",
  local: false,
  id: "sample:example-medical",
} as const;

interface Source {
  name: string;
  url: string;
  local: boolean;
  /** Stable per file, so re-opening one reuses embeddings already paid for. */
  id: string;
}

/** Whether this document's chunks have been embedded for semantic search. */
type Semantic =
  | { status: "off" }
  | { status: "indexing" }
  | { status: "ready" }
  | { status: "unavailable" }
  | { status: "error"; message: string };

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

/** Adapts the embed endpoint to the shape the retrieval strategies expect. */
async function embedChunks(values: readonly string[]): Promise<number[][]> {
  const result = await embedViaApi(values);
  return result.embeddings;
}

function countSections(document: ExtractedDocument): number {
  return document.pages.reduce(
    (total, page) =>
      total + page.blocks.filter((block) => block.kind === "heading").length,
    0,
  );
}

export function DocumentWorkspace({
  aiEnabled = false,
  className,
}: {
  /** Resolved on the server: no Gateway key means no AI affordances at all. */
  aiEnabled?: boolean;
  className?: string;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const [hits, setHits] = useState<RetrievalHit[]>([]);
  const [semantic, setSemantic] = useState<Semantic>({ status: "off" });

  const chunks = useMemo(
    () => (extracted ? toChunks(extracted) : null),
    [extracted],
  );

  const store = useMemo(() => createIndexedDbVectorStore(), []);

  const service = useMemo(() => {
    if (!chunks) return null;
    const strategies = [lexicalStrategy(chunks)];

    if (semantic.status === "ready" && source) {
      strategies.push(
        denseStrategy({ store, documentId: source.id, embed: embedChunks }),
      );
    }

    return createRetrievalService(strategies);
  }, [chunks, semantic.status, source, store]);

  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef(0);

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
    setQuery("");
    setHits([]);
    setSemantic({ status: "off" });
    setPage(1);
    setSource(next);
  }

  function openFile(file: File) {
    const problem = reject(file);
    if (problem) {
      setError(problem);
      return;
    }
    open({
      name: file.name,
      url: URL.createObjectURL(file),
      local: true,
      id: `file:${file.name}:${file.size}`,
    });
  }

  function close() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setSource(null);
    setExtracted(null);
    setError(null);
    setQuery("");
    setHits([]);
    setSemantic({ status: "off" });
    setPage(1);
    if (inputRef.current) inputRef.current.value = "";
  }

  /**
   * Searches run from the input handler rather than an effect and a stale
   * response is dropped so a slow dense round trip cant overwrite a newer
   * query result.
   */
  function runSearch(next: string) {
    setQuery(next);

    const ticket = searchRef.current + 1;
    searchRef.current = ticket;

    if (!service || next.trim().length === 0) {
      setHits([]);
      return;
    }

    void service.search(next, MAX_RESULTS).then((found) => {
      if (searchRef.current === ticket) setHits(found);
    });
  }

  async function enableSemantic() {
    if (!chunks || !source) return;
    setSemantic({ status: "indexing" });

    try {
      if (!(await store.has(source.id))) {
        await indexDocument({
          store,
          documentId: source.id,
          chunks,
          embed: embedChunks,
        });
      }
      setSemantic({ status: "ready" });
      searchRef.current += 1;
      setHits([]);
    } catch (cause) {
      if (cause instanceof AiUnavailableError) {
        setSemantic({ status: "unavailable" });
        return;
      }
      setSemantic({
        status: "error",
        message: "Could not prepare semantic search for this report.",
      });
    }
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

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <SearchPanel
                query={query}
                hits={hits}
                ready={service !== null}
                semantic={aiEnabled ? semantic : { status: "unavailable" }}
                onQueryChange={runSearch}
                onEnableSemantic={() => void enableSemantic()}
                onJump={setPage}
              />

              <PdfViewer
                file={source.url}
                page={page}
                onPageChange={setPage}
                onExtracted={setExtracted}
                className="min-h-[70vh] flex-1"
              />
            </div>

            {aiEnabled ? (
              <ChatPanel
                service={service}
                onJump={setPage}
                className="lg:sticky lg:top-24 lg:w-96 lg:shrink-0"
              />
            ) : null}
          </div>
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

function SemanticToggle({
  semantic,
  onEnable,
}: {
  semantic: Semantic;
  onEnable: () => void;
}) {
  if (semantic.status === "unavailable") return null;

  if (semantic.status === "ready") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
        <Sparkles className="size-3" />
        Semantic search on
      </span>
    );
  }

  if (semantic.status === "error") {
    return (
      <p className="text-destructive px-1 text-xs" role="alert">
        {semantic.message}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <Button
        variant="outline"
        size="xs"
        className="rounded-pill"
        disabled={semantic.status === "indexing"}
        onClick={onEnable}
      >
        <Sparkles />
        {semantic.status === "indexing"
          ? "Preparing..."
          : "Turn on semantic search"}
      </Button>
      <span className="text-muted-foreground text-xs">
        Finds passages that mean the same thing. Sends this report&apos;s text
        to the AI provider.
      </span>
    </div>
  );
}

function SearchPanel({
  query,
  hits,
  ready,
  semantic,
  onQueryChange,
  onEnableSemantic,
  onJump,
}: {
  query: string;
  hits: RetrievalHit[];
  ready: boolean;
  semantic: Semantic;
  onQueryChange: (query: string) => void;
  onEnableSemantic: () => void;
  onJump: (page: number) => void;
}) {
  const searching = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="focus-within:border-ring focus-within:ring-ring/50 rounded-pill flex items-center gap-2 border px-3 py-1.5 focus-within:ring-[3px]">
        <Search className="text-muted-foreground size-4 shrink-0" />
        <input
          type="search"
          value={query}
          disabled={!ready}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={
            ready ? "Search this report" : "Reading the report text..."
          }
          aria-label="Search this report"
          className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
      </div>

      {ready ? (
        <SemanticToggle semantic={semantic} onEnable={onEnableSemantic} />
      ) : null}

      {searching ? (
        <div
          className="flex max-h-64 flex-col gap-1 overflow-y-auto"
          role="status"
          aria-live="polite"
          aria-label={`${hits.length} results`}
        >
          {hits.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              Nothing in this report matches that.
            </p>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.chunk.id}
                type="button"
                onClick={() => onJump(hit.chunk.page)}
                className="hover:bg-accent focus-visible:ring-ring/50 flex flex-col gap-1 rounded-lg border px-3 py-2 text-left outline-none focus-visible:ring-2"
              >
                <span className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
                  <span>Page {hit.chunk.page}</span>
                  {hit.chunk.headings.length > 0 ? (
                    <span className="truncate">
                      {hit.chunk.headings[hit.chunk.headings.length - 1]}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm leading-relaxed">
                  {snippet(hit.chunk.text, query)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
