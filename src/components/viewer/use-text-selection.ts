"use client";

import { useEffect, useState, type RefObject } from "react";

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
   * The selected words themselves, not a snapshot of where they were, so
   * anything anchored to them can follow as the document scrolls.
   */
  range: Range;
}

/** Where the words are on screen right now, and whether they can be seen. */
export interface RangePlace {
  rect: DOMRect;
  visible: boolean;
}

/**
 * The nearest ancestor that scrolls on its own. The PDF scrolls inside its
 * viewer, so words can leave that box while still being inside the window.
 */
function scrollerOf(node: Node): Element | null {
  let element = node instanceof Element ? node : node.parentElement;
  while (element && element !== document.body) {
    const { overflowY } = getComputedStyle(element);
    if (overflowY === "auto" || overflowY === "scroll") return element;
    element = element.parentElement;
  }
  return null;
}

/**
 * Measures the range and checks it's still on screen: inside the box that
 * scrolls it, and not tucked under the sticky header.
 */
function placeOf(range: Range): RangePlace {
  const rect = range.getBoundingClientRect();
  // A text layer that re-rendered (a new page, a new zoom) leaves the range
  // pointing at nodes that are gone.
  if (!range.startContainer.isConnected) return { rect, visible: false };

  const box = scrollerOf(
    range.commonAncestorContainer,
  )?.getBoundingClientRect();
  const header = document.querySelector("header")?.getBoundingClientRect();
  const top = Math.max(box?.top ?? 0, header?.bottom ?? 0);
  const bottom = Math.min(box?.bottom ?? Infinity, window.innerHeight);
  const left = Math.max(box?.left ?? 0, 0);
  const right = Math.min(box?.right ?? Infinity, window.innerWidth);

  const visible =
    rect.bottom > top &&
    rect.top < bottom &&
    rect.right > left &&
    rect.left < right;
  return { rect, visible };
}

/**
 * Follows a range around the screen. Every scroll, including the PDF's own,
 * re-measures it once per frame, so a tooltip anchored to it stays on the
 * words instead of on the spot where they used to be.
 */
export function useRangePlace(range: Range | null): RangePlace | null {
  // Each measurement remembers which range it was taken from, so a stale one
  // is never shown for a new selection.
  const [measured, setMeasured] = useState<{
    range: Range;
    place: RangePlace;
  } | null>(null);

  useEffect(() => {
    if (!range) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      setMeasured({ range, place: placeOf(range) });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [range]);

  return range && measured?.range === range ? measured.place : null;
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

function sameRange(a: Range, b: Range): boolean {
  try {
    return (
      a.compareBoundaryPoints(Range.START_TO_START, b) === 0 &&
      a.compareBoundaryPoints(Range.END_TO_END, b) === 0
    );
  } catch {
    // The old range points into a text layer that has since been replaced.
    return false;
  }
}

/**
 * Watches what the reader selects inside the PDF viewer. We keep the range, not
 * just its position, so the button can follow the words as the document
 * scrolls (see `useRangePlace`).
 */
export function useTextSelection(
  container: RefObject<HTMLElement | null>,
): TextSelection | null {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

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
        setSelection(null);
        return;
      }

      setSelection((previous) =>
        // The same words selected again keep the same range, so anything
        // following them doesn't restart.
        previous && sameRange(previous.range, range)
          ? previous
          : { text, range: range.cloneRange() },
      );
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    }

    document.addEventListener("selectionchange", schedule);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", schedule);
    };
  }, [container]);

  return selection;
}
