"use client";

import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/lib/utils";

// Keyframes rather than transitions: the theme provider switches transitions
// off for the moment the theme changes, but a newly matching animation still
// plays.
const ICON =
  "motion-safe:animate-[icon-in_500ms_cubic-bezier(0.34,1.56,0.64,1)_both]";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    if (prefersReducedMotion() || !document.startViewTransition) {
      setTheme(next);
      return;
    }

    // The new theme grows out of the toggle as a circle, big enough to reach
    // the farthest corner of the window.
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const reach = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const root = document.documentElement;
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-r", `${reach}px`);
    root.classList.add("theme-reveal");

    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    void transition.finished.finally(() =>
      root.classList.remove("theme-reveal"),
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-pill"
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <MoonStar className={`${ICON} dark:hidden`} />
      <Sun className={`${ICON} hidden dark:block`} />
    </Button>
  );
}
