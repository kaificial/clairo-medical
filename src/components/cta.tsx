"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import type { ComponentProps, PointerEvent } from "react";

import { cn } from "@/lib/utils";

type CtaProps = Omit<ComponentProps<typeof Link>, "children"> & {
  label: string;
};

/** Keeps a space from collapsing to nothing inside an inline-block letter. */
const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/**
 * The label twice over, one copy stacked under the other. On hover each
 * letter rolls up to its twin a beat after the one before it.
 */
function RollingLabel({ label }: { label: string }) {
  return (
    <span className="cta-roll" aria-hidden>
      {[...label].map((char, index) => {
        const shown = char === " " ? NO_BREAK_SPACE : char;
        return (
          <span
            key={index}
            className="cta-roll-char"
            data-char={shown}
            style={{ transitionDelay: `${index * 16}ms` }}
          >
            {shown}
          </span>
        );
      })}
    </span>
  );
}

const PULL = { stiffness: 220, damping: 18, mass: 0.5 };

/**
 * Leans toward the pointer while it's over the button, a few pixels at most,
 * and springs back when it leaves.
 */
function useMagnet(strength = 0.12, limit = 3) {
  const reduce = useReducedMotion();
  const x = useSpring(0, PULL);
  const y = useSpring(0, PULL);

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.max(-limit, Math.min(limit, value));
    x.set(clamp((event.clientX - box.left - box.width / 2) * strength));
    y.set(clamp((event.clientY - box.top - box.height / 2) * strength));
  }

  function onPointerLeave() {
    x.set(0);
    y.set(0);
  }

  return { style: { x, y }, onPointerMove, onPointerLeave };
}

/** The main call to action: a rolling label and an arrow that swaps out. */
export function PrimaryCta({
  label,
  size = "lg",
  className,
  ...props
}: CtaProps & { size?: "default" | "lg" }) {
  const magnet = useMagnet();
  return (
    <motion.span
      className={cn("inline-flex", className)}
      style={magnet.style}
      onPointerMove={magnet.onPointerMove}
      onPointerLeave={magnet.onPointerLeave}
    >
      <Link
        {...props}
        aria-label={label}
        data-size={size}
        className="cta-primary focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
      >
        <RollingLabel label={label} />
        <span className="cta-arrows" aria-hidden>
          <ArrowRight className="cta-arrow" />
          <ArrowRight className="cta-arrow cta-arrow-next" />
        </span>
      </Link>
    </motion.span>
  );
}

/**
 * A sheet of paper with a folded corner. On hover a second page slides out
 * from behind it, like pulling an example report off a stack.
 */
export function PaperCta({ label, className, ...props }: CtaProps) {
  return (
    <Link
      {...props}
      className={cn(
        "cta-paper focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        className,
      )}
    >
      <span className="cta-sheet" data-sheet="back" aria-hidden />
      <span className="cta-sheet" data-sheet="front" aria-hidden>
        <span className="cta-fold" />
      </span>
      <span className="relative">{label}</span>
    </Link>
  );
}
