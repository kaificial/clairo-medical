"use client";

import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";

export const transition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
} as const;

const VIEWPORT = { once: true, amount: 0.2 } as const;
const HIDDEN = { opacity: 0, y: 14 } as const;
const SHOWN = { opacity: 1, y: 0 } as const;

type RevealProps = HTMLMotionProps<"div"> & { delay?: number };

export function Reveal({ children, delay = 0, ...props }: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <motion.div {...props}>{children}</motion.div>;
  }

  return (
    <motion.div
      initial={HIDDEN}
      whileInView={SHOWN}
      viewport={VIEWPORT}
      transition={{ ...transition, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
