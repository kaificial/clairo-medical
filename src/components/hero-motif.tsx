import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

const SIZE = 1200;
const C = SIZE / 2;

const RINGS = 9;
const BASE = 104; // radius of the innermost spiral
const GROWTH = 1.34; // geometric spacing denser near the centre
const TWIST = 17; // degrees added per ring, so the bloom spirals

/** One circle outline (four overlapping circles) at overall radius r. */
function Quatrefoil({ r, opacity }: { r: number; opacity: number }) {
  const a = r / 2; // radius
  return (
    <g fill="none" strokeOpacity={opacity}>
      <circle cx={C} cy={C - a} r={a} />
      <circle cx={C + a} cy={C} r={a} />
      <circle cx={C} cy={C + a} r={a} />
      <circle cx={C - a} cy={C} r={a} />
    </g>
  );
}

export function HeroMotif({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
      className={cn("text-border", className)}
      {...props}
    >
      <mask id="hero-motif-fade">
        <radialGradient id="hero-motif-fade-gradient">
          <stop offset="0%" stopColor="black" />
          <stop offset="11%" stopColor="black" />
          <stop offset="26%" stopColor="white" />
          <stop offset="60%" stopColor="white" />
          <stop offset="94%" stopColor="black" />
        </radialGradient>
        <rect
          width={SIZE}
          height={SIZE}
          fill="url(#hero-motif-fade-gradient)"
        />
      </mask>

      <g
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        mask="url(#hero-motif-fade)"
      >
        {Array.from({ length: RINGS }, (_, i) => {
          const r = BASE * GROWTH ** i;
          return (
            <g key={i} transform={`rotate(${i * TWIST} ${C} ${C})`}>
              <Quatrefoil r={r} opacity={Math.max(0.16, 0.5 - i * 0.035)} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
