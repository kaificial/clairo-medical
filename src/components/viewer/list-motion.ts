/*
 * Shared motion for clickable lists in the viewer: lab results, search hits
 * and suggested questions all arrive and respond the same way.
 */

/** Fades an item up into place. Pair it with `cascade` to stagger a list. */
export const RISE_IN =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-500";

/** Lifts a card a pixel on hover and settles it back on press. */
export const LIFT =
  "transition-[background-color,border-color,translate] duration-200 hover:-translate-y-px active:translate-y-0";

/** An arrow that slides in when its `group/item` parent is hovered. */
export const HOVER_ARROW =
  "size-3 shrink-0 -translate-x-1 opacity-0 transition-[opacity,translate] duration-200 group-hover/item:translate-x-0 group-hover/item:opacity-100";

const STEP_MS = 45;
/** Past this many items the rest arrive together, so long lists don't drag. */
const MOST_STAGGERED = 10;

/** How long the item at `index` waits before it arrives, in milliseconds. */
export function cascadeDelay(index: number, start = 0): number {
  return start + Math.min(index, MOST_STAGGERED) * STEP_MS;
}

/** The inline style that staggers the item at `index`. */
export const cascade = (index: number, start = 0) => ({
  animationDelay: `${cascadeDelay(index, start)}ms`,
});
