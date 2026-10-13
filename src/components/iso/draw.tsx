import type { ReactNode } from "react";

import type { Flat, LineTone, SolidPaths, Tone } from "./iso-kit";

/*
 * Server safe drawing pieces from the Anatomy kit
 * (https://skills.wheresryan.sh/anatomy, MIT). A solid paints its paper fill
 * first so it hides whatever sits behind it, then its shaded sides, its top
 * and finally its outline.
 */

const tenth = (value: number) => Math.round(value * 10) / 10;

export function Solid({
  paths,
  tone = "hi",
  crease = "faint",
  lit = false,
  flat = false,
  className,
  inner,
}: {
  paths: SolidPaths;
  tone?: Tone;
  crease?: Tone | "none";
  lit?: boolean;
  flat?: boolean;
  className?: string;
  inner?: ReactNode;
}) {
  return (
    <g
      className={className ? `iso-solid ${className}` : "iso-solid"}
      data-lit={lit ? "" : undefined}
    >
      <path className="iso-fill" d={paths.fill} />
      {flat
        ? null
        : paths.shades.map((d, shade) =>
            d ? (
              <path
                key={shade}
                className="iso-shade"
                data-shade={shade}
                d={d}
              />
            ) : null,
          )}
      {flat ? null : <path className="iso-top" d={paths.top} />}
      {crease === "none" || !paths.crease ? null : (
        <path className="iso-line" data-tone={crease} d={paths.crease} />
      )}
      {crease === "none" || !paths.bevel ? null : (
        <path className="iso-line" data-tone={crease} d={paths.bevel} />
      )}
      {inner}
      <path className="iso-line" data-tone={tone} d={paths.outline} />
    </g>
  );
}

export function Line({
  d,
  tone = "lo",
  className,
}: {
  d: string;
  tone?: LineTone;
  className?: string;
}) {
  if (!d) return null;
  return (
    <path
      className={className ? `iso-line ${className}` : "iso-line"}
      data-tone={tone}
      d={d}
    />
  );
}

export function Dots({
  points,
  size = 0.5,
  tone = "mid",
}: {
  points: Flat[];
  size?: number;
  tone?: Tone;
}) {
  return (
    <g className="iso-dots" data-tone={tone}>
      {points.map(([x, y], index) => (
        <circle key={index} cx={tenth(x)} cy={tenth(y)} r={size} />
      ))}
    </g>
  );
}

export function FaceText({
  transform,
  children,
  size = 3,
  tone = "mid",
}: {
  transform: string;
  children: ReactNode;
  size?: number;
  tone?: Tone;
}) {
  return (
    <text
      className="iso-face-text"
      data-tone={tone}
      transform={transform}
      fontSize={size}
    >
      {children}
    </text>
  );
}
