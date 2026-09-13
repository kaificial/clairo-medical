import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

const SIZE = 1200;
const CENTER = SIZE / 2;

const RINGS = 9;
const INNER_RADIUS = 104;
/**
 * Each ring is this much wider than the one inside it. Growing them
 * geometrically packs the rings tighter toward the middle and lets them open
 * out toward the edges.
 */
const GROWTH = 1.34;
/**
 * How far each ring is rotated past the one inside it, in degrees. Without the
 * twist the rings line up into a grid; with it they read as a slow spiral.
 */
const TWIST = 17;
const INNER_OPACITY = 0.6;
const OPACITY_STEP = 0.035;
const MIN_OPACITY = 0.28;

const SPIN = "origin-center [transform-box:fill-box]";

/**
 * Four circles overlapping at the centre, the same idea as the Clairo mark,
 * sized so the outer edge sits `radius` from the middle.
 */
function Quatrefoil({ radius, opacity }: { radius: number; opacity: number }) {
  const r = radius / 2;
  return (
    <g fill="none" strokeOpacity={opacity}>
      <circle cx={CENTER} cy={CENTER - r} r={r} />
      <circle cx={CENTER + r} cy={CENTER} r={r} />
      <circle cx={CENTER} cy={CENTER + r} r={r} />
      <circle cx={CENTER - r} cy={CENTER} r={r} />
    </g>
  );
}

/**
 * Half the rings, the even or the odd ones. The two halves spin opposite ways
 * at different speeds, which keeps the pattern shifting without looking busy.
 */
function RingGroup({ parity }: { parity: 0 | 1 }) {
  const rings = Array.from({ length: RINGS }, (_, ring) => ring).filter(
    (ring) => ring % 2 === parity,
  );

  return rings.map((ring) => (
    <g key={ring} transform={`rotate(${ring * TWIST} ${CENTER} ${CENTER})`}>
      <Quatrefoil
        radius={INNER_RADIUS * GROWTH ** ring}
        opacity={Math.max(MIN_OPACITY, INNER_OPACITY - ring * OPACITY_STEP)}
      />
    </g>
  ));
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
        <g
          className={cn(
            SPIN,
            "motion-safe:animate-[hero-bloom-spin_150s_linear_infinite]",
          )}
        >
          <RingGroup parity={0} />
        </g>
        <g
          className={cn(
            SPIN,
            "motion-safe:animate-[hero-bloom-spin_110s_linear_infinite_reverse]",
          )}
        >
          <RingGroup parity={1} />
        </g>
      </g>
    </svg>
  );
}
