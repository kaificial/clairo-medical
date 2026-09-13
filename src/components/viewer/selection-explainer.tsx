"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  AiUnavailableError,
  explainTerm,
  failureMessage,
} from "@/lib/ai/client";
import type { Chunk } from "@/lib/pdf";
import type { Search } from "@/lib/retrieval";

import { AnswerText } from "./answer-text";
import { useTextSelection, type TextSelection } from "./use-text-selection";

const MAX_PASSAGES = 4;
const PANEL_WIDTH = 320;
const PILL_WIDTH = 132;
const GAP = 8;
const EDGE = 12;

interface Explanation {
  term: string;
  rect: DOMRect;
  text: string;
  status: "streaming" | "done" | "error";
  error?: string;
}

/**
 * The text layer and our extracted text break lines in different places, so
 * compare them with whitespace collapsed.
 */
function comparable(text: string): string {
  return text.replace(/\s+/g, " ").toLowerCase();
}

/**
 * A mousedown would normally clear the reader's selection, and the Explain
 * button would disappear before its click landed.
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
 * Highlight any word in the report and a small "Explain this" button appears
 * next to it. The answer shows up right by the word rather than off in a
 * sidebar, so the reader doesn't lose their place.
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

  async function explain({ text: term, rect }: TextSelection) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setExplanation({ term, rect, text: "", status: "streaming" });

    try {
      const related = search ? await search(term, MAX_PASSAGES) : [];
      const passages = orderPassages(
        term,
        chunks ?? [],
        related.map((hit) => hit.chunk),
      );

      await explainTerm({
        term,
        passages,
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

  if (unavailable) return null;

  if (explanation) {
    const { top, left } = anchor(explanation.rect, PANEL_WIDTH);

    return (
      <div
        role="dialog"
        aria-label={`What ${explanation.term} means`}
        style={{ top, left, width: PANEL_WIDTH }}
        onMouseDown={keepSelection}
        className="bg-popover fixed z-50 flex flex-col gap-2 rounded-xl border p-3 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium break-words">{explanation.term}</p>
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
          <AnswerText text={explanation.text} onJump={onJump} />
          {explanation.status === "streaming" &&
          explanation.text.length === 0 ? (
            <Loader2 className="inline size-3.5 animate-spin" />
          ) : null}
        </p>

        {explanation.status === "error" ? (
          <p className="text-destructive text-xs" role="alert">
            {explanation.error}
          </p>
        ) : null}
      </div>
    );
  }

  if (!selection || !chunks) return null;

  const { top, left } = anchor(selection.rect, PILL_WIDTH);

  return (
    <Button
      variant="secondary"
      size="xs"
      style={{ top, left }}
      onMouseDown={keepSelection}
      onClick={() => void explain(selection)}
      aria-label={`Explain "${selection.text}"`}
      className="rounded-pill fixed z-50 shadow-md"
    >
      <Sparkles />
      Explain this
    </Button>
  );
}
