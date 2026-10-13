import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { prefersReducedMotion } from "@/lib/utils";

/*
 * Motion helpers from the Anatomy kit. Everything is time based, so a slow
 * frame or a background tab never makes a part jump.
 */

const LONGEST_FRAME = 1 / 30;

/**
 * Eases a value toward its target. `seconds` is how long it takes to cover
 * about two thirds of the way, so the part starts quickly and settles softly.
 */
export function follow(
  current: number,
  target: number,
  dt: number,
  seconds: number,
  calm = false,
) {
  if (calm) return target;
  const next = current + (target - current) * (1 - Math.exp(-dt / seconds));
  return Math.abs(target - next) < 1e-3 ? target : next;
}

/**
 * Runs `tick` once a frame while `running`, until it returns false. The kick
 * it hands back starts the loop again after an input.
 */
export function useLoop(
  tick: (dt: number, calm: boolean) => boolean,
  running: boolean,
) {
  const latest = useRef(tick);
  const frame = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    latest.current = tick;
  });

  const kick = useCallback(() => {
    if (frame.current) return;
    last.current = 0;
    const step = (now: number) => {
      const dt = last.current
        ? Math.min((now - last.current) / 1000, LONGEST_FRAME)
        : 1 / 60;
      last.current = now;
      const more = latest.current(dt, prefersReducedMotion());
      frame.current = more ? requestAnimationFrame(step) : 0;
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (running) kick();
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [running, kick]);

  return kick;
}

/**
 * True while the element is on screen, with a little margin so motion is
 * already running when it scrolls in.
 */
export function useOnScreen(ref: RefObject<Element | null>) {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // When the element leaves and comes back between two callbacks, both
    // entries arrive together, oldest first, so only the last one counts.
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(Boolean(entries.at(-1)?.isIntersecting)),
      { rootMargin: "120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return onScreen;
}
