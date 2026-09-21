"use client";

import { Loader2, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  AiUnavailableError,
  explainTerm,
  failureMessage,
  simplifyText,
} from "@/lib/ai/client";
import type { Chunk } from "@/lib/pdf";
import type { Search } from "@/lib/retrieval";

import { AnswerText } from "./answer-text";
import { useTextSelection, type TextSelection } from "./use-text-selection";

const MAX_PASSAGES = 4;
const PANEL_WIDTH = 320;
const PILL_WIDTH = 220;
const GAP = 8;
const EDGE = 12;

type Mode = "explain" | "exact";

interface Explanation {
  term: string;
  rect: DOMRect;
  mode: Mode;
  text: string;
  status: "streaming" | "done" | "error";
  error?: string;
  /** The plain reading, once asked for. Kept alongside the original so the
   * reader can flip back without asking the model twice. */
  simple: string | null;
  simplifying: boolean;
  /** Which of `text` / `simple` is on screen right now. */
  showing: "original" | "simple";
}

/**
 * The text layer and our extracted text break lines in different places, so
 * compare them with whitespace collapsed.
 */
function comparable(text: string): string {
  return text.replace(/\s+/g, " ").toLowerCase();
}

/**
 * A mousedown would normally clear the reader's selection, and the pill's
 * buttons would disappear before their click landed.
 */
function keepSelection(event: React.MouseEvent) {
  event.preventDefault();
}

/**
 * Picks the passages sent with a definition. The ones that actually contain the
 * highlighted words come first, because that's the page the reader is looking
 * at and the one worth citing. Search results fill whatever room is left.
 */
function orderPassages(
  term: string,
  chunks: readonly Chunk[],
  related: readonly Chunk[],
): Chunk[] {
  const needle = comparable(term);
  const containing = chunks.filter((chunk) =>
    comparable(chunk.text).includes(needle),
  );
  const unique = new Map(
    [...containing, ...related].map((chunk) => [chunk.id, chunk]),
  );
  return [...unique.values()].slice(0, MAX_PASSAGES);
}

/**
 * Places a panel just under the highlight and centred on it, nudged in from the
 * window edge when the highlight sits near a side.
 */
function anchor(rect: DOMRect, width: number): { top: number; left: number } {
  const centre = rect.left + rect.width / 2 - width / 2;
  const limit = Math.max(EDGE, window.innerWidth - width - EDGE);

  return {
    top: rect.bottom + GAP,
    left: Math.min(Math.max(EDGE, centre), limit),
  };
}

/**
 * Highlight any word in the report and a small pill appears next to it, offering
 * a report-grounded explanation or the plain dictionary definition. The answer
 * shows up right by the word rather than off in a sidebar, so the reader
 * doesn't lose their place, and it can be reworded at a fifth grade level with
 * one more click.
 */
export function SelectionExplainer({
  containerRef,
  chunks,
  search,
  onJump,
}: {
  containerRef: RefObject<HTMLElement | null>;
  chunks: readonly Chunk[] | null;
  search: Search | null;
  onJump: (page: number) => void;
}) {
  const selection = useTextSelection(containerRef);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  function close() {
    requestRef.current?.abort();
    requestRef.current = null;
    setExplanation(null);
  }

  // Highlighting something else means the reader has moved on, so drop the old
  // explanation.
  useEffect(() => {
    if (selection && explanation && selection.text !== explanation.term) {
      close();
    }
  }, [selection, explanation]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => requestRef.current?.abort(), []);

  function amend(term: string, change: (current: Explanation) => Explanation) {
    setExplanation((current) =>
      current && current.term === term ? change(current) : current,
    );
  }

  async function explain({ text: term, rect }: TextSelection, mode: Mode) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setExplanation({
      term,
      rect,
      mode,
      text: "",
      status: "streaming",
      simple: null,
      simplifying: false,
      showing: "original",
    });

    try {
      const related =
        mode === "explain" && search ? await search(term, MAX_PASSAGES) : [];
      const passages =
        mode === "explain"
          ? orderPassages(
              term,
              chunks ?? [],
              related.map((hit) => hit.chunk),
            )
          : [];

      await explainTerm({
        term,
        passages,
        mode,
        signal: controller.signal,
        onDelta: (delta) =>
          amend(term, (current) => ({
            ...current,
            text: current.text + delta,
          })),
      });

      amend(term, (current) => ({ ...current, status: "done" }));
    } catch (cause) {
      if (controller.signal.aborted) return;

      if (cause instanceof AiUnavailableError) {
        setUnavailable(true);
        setExplanation(null);
        return;
      }

      amend(term, (current) => ({
        ...current,
        status: "error",
        error: failureMessage(
          cause,
          "That explanation did not come through. Try again.",
        ),
      }));
    }
  }

  async function simplify(term: string, text: string) {
    amend(term, (current) => ({ ...current, simplifying: true, simple: "" }));

    try {
      await simplifyText({
        text,
        onDelta: (delta) =>
          amend(term, (current) => ({
            ...current,
            simple: (current.simple ?? "") + delta,
          })),
      });
      amend(term, (current) => ({
        ...current,
        simplifying: false,
        showing: "simple",
      }));
    } catch {
      // The original explanation is still on screen, so a failed simplify
      // just quietly leaves it there rather than showing a second error.
      amend(term, (current) => ({
        ...current,
        simplifying: false,
        simple: null,
      }));
    }
  }

  if (unavailable) return null;

  if (explanation) {
    const { top, left } = anchor(explanation.rect, PANEL_WIDTH);
    const shown =
      explanation.showing === "simple" && explanation.simple !== null
        ? explanation.simple
        : explanation.text;
    const canSimplify =
      explanation.status === "done" && explanation.text.length > 0;

    return (
      <div
        role="dialog"
        aria-label={`What ${explanation.term} means`}
        style={{ top, left, width: PANEL_WIDTH }}
        onMouseDown={keepSelection}
        className="bg-popover animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 fixed z-50 flex origin-top flex-col gap-2.5 rounded-2xl border p-3.5 shadow-lg duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Logo className="text-muted-foreground size-3.5 shrink-0" />
            <p className="truncate text-sm font-medium">{explanation.term}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-pill shrink-0"
            aria-label="Close explanation"
            onClick={close}
          >
            <X />
          </Button>
        </div>

        <p
          className="text-muted-foreground text-sm leading-relaxed"
          aria-live="polite"
        >
          <AnswerText text={shown} onJump={onJump} />
          {(explanation.status === "streaming" && shown.length === 0) ||
          explanation.simplifying ? (
            <Loader2 className="inline size-3.5 animate-spin" />
          ) : null}
        </p>

        {explanation.status === "error" ? (
          <p className="text-destructive text-xs" role="alert">
            {explanation.error}
          </p>
        ) : null}

        {canSimplify ? (
          <div className="flex items-center gap-1 border-t pt-2">
            {explanation.simple === null ? (
              <button
                type="button"
                onClick={() =>
                  void simplify(explanation.term, explanation.text)
                }
                disabled={explanation.simplifying}
                className="text-muted-foreground hover:text-foreground rounded-pill flex items-center gap-1 text-xs transition-colors disabled:opacity-60"
              >
                <Pencil className="size-3" />
                Simplify
              </button>
            ) : (
              <button
                type="button"
                disabled={explanation.simplifying}
                onClick={() =>
                  amend(explanation.term, (current) => ({
                    ...current,
                    showing:
                      current.showing === "simple" ? "original" : "simple",
                  }))
                }
                className="text-muted-foreground hover:text-foreground rounded-pill flex items-center gap-1 text-xs transition-colors disabled:opacity-60"
              >
                <Pencil className="size-3" />
                {explanation.simplifying
                  ? "Simplifying..."
                  : explanation.showing === "simple"
                    ? "Show original"
                    : "Simplify again"}
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (!selection || !chunks) return null;

  const { top, left } = anchor(selection.rect, PILL_WIDTH);

  return (
    <div
      role="group"
      aria-label={`Explain or define "${selection.text}"`}
      style={{ top, left, width: PILL_WIDTH }}
      onMouseDown={keepSelection}
      className="bg-popover animate-in fade-in-0 zoom-in-95 rounded-pill fixed z-50 flex items-stretch overflow-hidden border shadow-md duration-100"
    >
      <button
        type="button"
        onClick={() => void explain(selection, "explain")}
        className="hover:bg-accent flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
      >
        <Logo className="size-3.5" />
        Explain
      </button>
      <div className="bg-border w-px shrink-0" aria-hidden />
      <button
        type="button"
        onClick={() => void explain(selection, "exact")}
        className="hover:bg-accent flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
      >
        Definition
      </button>
    </div>
  );
}
