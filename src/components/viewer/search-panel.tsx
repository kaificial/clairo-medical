"use client";

import { Loader2, Search as SearchIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  AiUnavailableError,
  embedViaApi,
  failureMessage,
} from "@/lib/ai/client";
import { createLocalEmbedder, type LocalProgress } from "@/lib/embeddings";
import type { Chunk } from "@/lib/pdf";
import {
  createIndexedDbVectorStore,
  denseStrategy,
  hybridSearch,
  indexDocument,
  lexicalStrategy,
  sectionStrategy,
  snippet,
  type RetrievalHit,
  type Search,
} from "@/lib/retrieval";

const MAX_RESULTS = 5;
const MB = 1024 * 1024;

// Creating these costs nothing. The IndexedDB connection and the model download
// only happen once someone turns semantic search on.
const store = createIndexedDbVectorStore();
const local = createLocalEmbedder();

/**
 * Where passages get embedded: in this browser with the small local model, or
 * by the AI provider.
 */
type Engine = "device" | "cloud";

type Semantic =
  | { status: "off" }
  | { status: "preparing"; progress: string | null }
  | { status: "ready"; engine: Engine }
  | { status: "error"; message: string };

/**
 * Vectors from different models can't be compared, so each model gets its own
 * key and switching between device and cloud never mixes them up.
 */
function vectorKey(documentId: string, engine: Engine): string {
  return `${documentId}|${engine === "device" ? `local:${local.model.key}` : "cloud"}`;
}

function describeProgress(progress: LocalProgress): string {
  if (progress.stage === "download") {
    const total = Math.max(1, Math.round(progress.total / MB));
    return `Downloading the model, ${Math.round(progress.loaded / MB)} of ${total} MB`;
  }
  return `Reading passages, ${progress.done} of ${progress.total}`;
}

function semanticFailure(cause: unknown, engine: Engine): string {
  if (cause instanceof AiUnavailableError) {
    return "Cloud AI is not configured. Semantic search on this device still works.";
  }
  return failureMessage(
    cause,
    engine === "device"
      ? "The on-device model could not load. Check your connection and try again."
      : "Could not prepare semantic search for this report.",
  );
}

/**
 * Search for one document. Keywords and section routing work straight away;
 * semantic search joins in only after the reader turns it on, because embedding
 * a report costs a model download or a trip to the provider.
 */
export function useDocumentSearch(
  documentId: string,
  chunks: readonly Chunk[] | null,
) {
  const [semantic, setSemantic] = useState<Semantic>({ status: "off" });
  const engine = semantic.status === "ready" ? semantic.engine : null;

  const search = useMemo((): Search | null => {
    if (!chunks) return null;

    const strategies = [lexicalStrategy(chunks), sectionStrategy(chunks)];
    if (engine) {
      strategies.push(
        denseStrategy({
          store,
          documentId: vectorKey(documentId, engine),
          embedQuery: engine === "device" ? local.query : embedViaApi,
        }),
      );
    }
    return hybridSearch(strategies);
  }, [chunks, documentId, engine]);

  async function enableSemantic(next: Engine) {
    if (!chunks) return;
    setSemantic({ status: "preparing", progress: null });

    try {
      const key = vectorKey(documentId, next);
      if (!(await store.has(key))) {
        await indexDocument({
          store,
          documentId: key,
          chunks,
          embed:
            next === "device"
              ? (values) =>
                  local.passages(values, (progress) =>
                    setSemantic({
                      status: "preparing",
                      progress: describeProgress(progress),
                    }),
                  )
              : embedViaApi,
        });
      }
      setSemantic({ status: "ready", engine: next });
    } catch (cause) {
      setSemantic({ status: "error", message: semanticFailure(cause, next) });
    }
  }

  return { search, semantic, enableSemantic };
}

export function SearchPanel({
  search,
  semantic,
  cloudAvailable,
  onEnableSemantic,
  onJump,
}: {
  /** Null until the report's text has been read and indexed. */
  search: Search | null;
  semantic: Semantic;
  cloudAvailable: boolean;
  onEnableSemantic: (engine: Engine) => void;
  onJump: (page: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    search: Search | null;
    hits: RetrievalHit[];
  }>({ search: null, hits: [] });
  const latest = useRef(0);

  // Hits are tied to the search that found them. When semantic search switches
  // on, the old keyword hits go away instead of lingering under the new mode.
  const hits = results.search === search ? results.hits : [];

  /**
   * Every keystroke starts a search, and a semantic one can take a moment. The
   * ticket makes sure a slow answer to an old query never replaces the answer
   * to a newer one.
   */
  function run(next: string) {
    setQuery(next);
    const ticket = (latest.current += 1);

    if (!search || next.trim().length === 0) {
      setResults({ search, hits: [] });
      return;
    }
    void search(next, MAX_RESULTS).then((found) => {
      if (latest.current === ticket) setResults({ search, hits: found });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="focus-within:border-ring focus-within:ring-ring/50 rounded-pill flex items-center gap-2 border px-3 py-1.5 focus-within:ring-[3px]">
        <SearchIcon className="text-muted-foreground size-4 shrink-0" />
        <input
          type="search"
          value={query}
          disabled={!search}
          onChange={(event) => run(event.target.value)}
          placeholder={
            search ? "Search this report" : "Reading the report text..."
          }
          aria-label="Search this report"
          className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
      </div>

      {search ? (
        <SemanticToggle
          semantic={semantic}
          cloudAvailable={cloudAvailable}
          onEnable={onEnableSemantic}
        />
      ) : null}

      {query.trim().length > 0 ? (
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
            hits.map(({ chunk }) => (
              <button
                key={chunk.id}
                type="button"
                onClick={() => onJump(chunk.page)}
                className="hover:bg-accent focus-visible:ring-ring/50 flex flex-col gap-1 rounded-lg border px-3 py-2 text-left outline-none focus-visible:ring-2"
              >
                <span className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
                  <span>Page {chunk.page}</span>
                  {chunk.headings.length > 0 ? (
                    <span className="truncate">{chunk.headings.at(-1)}</span>
                  ) : null}
                </span>
                <span className="text-sm leading-relaxed">
                  {snippet(chunk.text, query)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function SemanticToggle({
  semantic,
  cloudAvailable,
  onEnable,
}: {
  semantic: Semantic;
  cloudAvailable: boolean;
  onEnable: (engine: Engine) => void;
}) {
  if (semantic.status === "ready") {
    return (
      <span
        className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs"
        role="status"
      >
        <Logo className="size-3" />
        Semantic search on,{" "}
        {semantic.engine === "device"
          ? "running on this device"
          : "through the AI provider"}
      </span>
    );
  }

  if (semantic.status === "preparing") {
    return (
      <span
        className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-3 animate-spin" />
        {semantic.progress ?? "Starting..."}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button
          variant="outline"
          size="xs"
          className="rounded-pill"
          onClick={() => onEnable("device")}
        >
          <Logo />
          Turn on semantic search
        </Button>
        <span className="text-muted-foreground text-xs text-pretty">
          Finds passages that mean the same thing. Runs on this device after a
          one time {local.model.downloadMb} MB model download, and sends
          nothing.
        </span>
        {cloudAvailable ? (
          <button
            type="button"
            onClick={() => onEnable("cloud")}
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
          >
            Use the AI provider instead
          </button>
        ) : null}
      </div>
      {semantic.status === "error" ? (
        <p className="text-destructive text-xs" role="alert">
          {semantic.message}
        </p>
      ) : null}
    </div>
  );
}
