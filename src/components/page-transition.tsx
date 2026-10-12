import { type ReactNode, ViewTransition } from "react";

/**
 * Animates a page:
 */
const PAGE_MOTION = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "page-fade",
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={PAGE_MOTION} exit={PAGE_MOTION} default="none">
      {children}
    </ViewTransition>
  );
}
