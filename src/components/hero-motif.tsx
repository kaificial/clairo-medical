import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

const SIZE = 1200;
const C = SIZE / 2;

const RINGS = 9;
const BASE = 104; // radius of the innermost spiral
const GROWTH = 1.34; // geometric spacing denser near the centre
const TWIST = 17; // degrees added per ring, so the bloom spirals

/** One circle outline (four overlapping circles) at overall radius `r`. */
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

function RingGroup({ parity }: { parity: 0 | 1 }) {
  return (
    <>
      {Array.from({ length: RINGS }, (_, i) => i)
        .filter((i) => i % 2 === parity)
        .map((i) => (
          <g key={i} transform={`rotate(${i * TWIST} ${C} ${C})`}>
            <Quatrefoil
              r={BASE * GROWTH ** i}
              opacity={Math.max(0.13, 0.4 - i * 0.037)}
            />
          </g>
        ))}
    </>
  );
}

export function HeroMotif({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
      className={cn("text-hero-lines", className)}
      {...props}
    >
      <mask id="hero-motif-fade">
        <radialGradient id="hero-motif-fade-gradient">
          <stop offset="0%" stopColor="black" />
          <stop offset="16%" stopColor="black" />
          <stop offset="34%" stopColor="white" />
          <stop offset="62%" stopColor="white" />
          <stop offset="84%" stopColor="black" />
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
        <g className="origin-center [transform-box:fill-box] motion-safe:animate-[hero-bloom-spin_150s_linear_infinite]">
          <RingGroup parity={0} />
        </g>
        <g className="origin-center [transform-box:fill-box] motion-safe:animate-[hero-bloom-spin_110s_linear_infinite_reverse]">
          <RingGroup parity={1} />
        </g>
      </g>
    </svg>
  );
}
