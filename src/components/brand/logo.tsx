import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Hero background design
 */
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
