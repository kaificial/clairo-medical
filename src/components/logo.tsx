import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Gives the mark a springy quarter turn when its `group` parent is hovered.
 * The shape is symmetric, so it comes to rest looking the same.
 */
export const LOGO_SPIN =
  "transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-90 motion-reduce:transition-none";

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Clairo"
      className={cn("size-6", className)}
      {...props}
    >
      <mask id="clairo-mark-window">
        <rect width="24" height="24" fill="white" />
        <rect x="8.4" y="8.4" width="7.2" height="7.2" rx="2.4" fill="black" />
      </mask>
      <g fill="currentColor" mask="url(#clairo-mark-window)">
        <circle cx="12" cy="7.3" r="5.4" />
        <circle cx="16.7" cy="12" r="5.4" />
        <circle cx="12" cy="16.7" r="5.4" />
        <circle cx="7.3" cy="12" r="5.4" />
      </g>
    </svg>
  );
}

/**
 * The mark as a loading indicator. Every quarter turn lands on the same
 * shape, so the loop looks seamless.
 */
export function LogoLoader({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-flex align-[-0.15em]", className)}
    >
      <Logo
        aria-hidden
        role="presentation"
        className="logo-loading text-foreground/70 size-full"
      />
    </span>
  );
}
