"use client";

import { motion, useReducedMotion, useSpring } from "motion/react";
import {
  useEffect,
  type ComponentProps,
  type PointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const SOFT = { stiffness: 120, damping: 20, mass: 0.6 };

/**
 * Drifts its contents a few pixels against the pointer, anywhere on the page,
 * so the background feels like it sits a layer behind the words.
 */
export function PointerDrift({
  strength = 14,
  className,
  children,
}: {
  strength?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useSpring(0, SOFT);
  const y = useSpring(0, SOFT);

  useEffect(() => {
    if (reduce) return;
    function move(event: globalThis.PointerEvent) {
      x.set((0.5 - event.clientX / window.innerWidth) * strength);
      y.set((0.5 - event.clientY / window.innerHeight) * strength);
    }
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, strength, x, y]);

  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

/**
 * A list item that lights up under the pointer, as if a small lamp were held
 * over the card.
 */
export function SpotlightItem({
  className,
  children,
  ...props
}: ComponentProps<"li">) {
  function move(event: PointerEvent<HTMLLIElement>) {
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
  }

  return (
    <li
      onPointerMove={move}
      className={cn(
        "group/spot relative isolate overflow-hidden",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
        "before:bg-[radial-gradient(360px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),var(--spotlight),transparent_70%)]",
        className,
      )}
      {...props}
    >
      {children}
    </li>
  );
}

/**
 * Highlights its words with a marker stroke the first time they scroll into
 * view.
 */
export function InViewMarker({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.mark
      className="marker rounded-[0.15em] box-decoration-clone px-1"
      initial={reduce ? false : { backgroundSize: "0% 100%" }}
      whileInView={{ backgroundSize: "100% 100%" }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1], delay: 0.25 }}
    >
      {children}
    </motion.mark>
  );
}
