"use client";

import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";

/**
 * Fades a landing page section up the first time it scrolls into view. People
 * who ask for reduced motion just get the section, no animation.
 */
export function Reveal(props: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  if (reduce) return <motion.div {...props} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}
