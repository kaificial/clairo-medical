"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * selectionchange fires on every pixel of a drag. Waiting a moment keeps the
 * Explain button from chasing the cursor around.
 */
const SETTLE_MS = 150;
const MIN_LENGTH = 2;
/**
 * Anything longer is probably someone selecting a paragraph to copy, not a term
 * they want explained.
 */
const MAX_LENGTH = 300;

export interface TextSelection {
  text: string;
  /**
   * In viewport coordinates, and updated as the page scrolls so the button
   * stays with the words.
   */
  rect: DOMRect;
}

/**
 * The PDF text layer keeps the page's line breaks, so a highlighted phrase can
 * come back as "acute\nkidney injury".
 */
export function normalizeSelection(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * A stray click selects a single character, and dragging over a column of
 * numbers selects no words at all. Neither is worth offering to explain.
 */
export function isExplainable(text: string): boolean {
  return (
    text.length >= MIN_LENGTH &&
    text.length <= MAX_LENGTH &&
    /\p{L}/u.test(text)
  );
}

/**
 * Watches what the reader selects inside the PDF viewer. We keep the range, not
 * just its position, so the button can follow the words as the document
 * scrolls.
 */
export function useTextSelection(
  container: RefObject<HTMLElement | null>,
): TextSelection | null {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const rangeRef = useRef<Range | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clear() {
      rangeRef.current = null;
      setSelection(null);
    }

    function read() {
      const node = container.current;
      const current = window.getSelection();
      const range =
        current && current.rangeCount > 0 && !current.isCollapsed
          ? current.getRangeAt(0)
          : null;
      const text = normalizeSelection(current?.toString() ?? "");

      if (
        !node ||
        !range ||
        !node.contains(range.commonAncestorContainer) ||
        !isExplainable(text)
      ) {
        clear();
        return;
      }

      rangeRef.current = range.cloneRange();
      setSelection({ text, rect: range.getBoundingClientRect() });
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    }

    function reposition() {
      const range = rangeRef.current;
      if (!range) return;

      const rect = range.getBoundingClientRect();
      setSelection((current) => (current ? { ...current, rect } : current));
    }

    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [container]);

  return selection;
}
