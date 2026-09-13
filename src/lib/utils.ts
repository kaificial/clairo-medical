import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Writes "page 2" or "pages 1, 3" for messages. Expects the pages already
 * sorted.
 */
export function pageList(pages: readonly number[]): string {
  return pages.length === 1 ? `page ${pages[0]}` : `pages ${pages.join(", ")}`;
}
