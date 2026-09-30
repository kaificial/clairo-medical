"use client";

import { TrendingDown } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const SPEED = 1;
const LIFT = 8;
const WORD_STAGGER = 0.07;
/**
 * The gauge, as fractions of its track: the normal band, where the dot starts
 * inside it, and where the reading actually lands.
 */
const GAUGE = { band: [0.22, 0.56], from: 0.4, to: 0.8 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const SMALL_SCREEN = "(max-width: 639px)";

/**
 * The loop, in order. Each beat shows one of the product's moves: highlight a
 * term, get it explained, see the result on its range, ask a question.
 */
const BEATS = [
  { name: "page", seconds: 1.4 },
  { name: "highlight", seconds: 1.2 },
  { name: "explain", seconds: 3.6 },
  { name: "range", seconds: 3.6 },
  { name: "ask", seconds: 4.4 },
  { name: "rest", seconds: 1 },
] as const;

type Beat = (typeof BEATS)[number]["name"];

const ANSWER = "Lactate, ALT and AST are above the typical range.";

const card = {
  initial: { opacity: 0, y: LIFT },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -LIFT / 2 },
  transition: { duration: 0.5, ease: EASE },
};

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

/**
 * Steps through the beats on a timer, but only while someone can see it.
 * Offscreen or in a hidden tab the timer stops and picks up where it left off.
 */
function useBeat(running: boolean, skipChat: boolean): Beat {
  const beats = skipChat ? BEATS.filter((beat) => beat.name !== "ask") : BEATS;
  const [step, setStep] = useState(0);
  const current = beats[step % beats.length] ?? BEATS[0];

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(
      () => setStep((previous) => (previous + 1) % beats.length),
      current.seconds * SPEED * 1000,
    );
    return () => clearTimeout(timer);
  }, [running, current, beats.length]);

  return current.name;
}

function Citation({ page }: { page: number }) {
  return (
    <span className="text-foreground mx-0.5 rounded border px-1 align-baseline font-mono text-[0.7rem]">
      p.{page}
    </span>
  );
}

function TextBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-muted-foreground/15 h-1.5 rounded-full", className)}
    />
  );
}

function Highlighted({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <motion.span
        className="bg-highlight text-highlight-foreground absolute inset-y-0 -right-1 -left-1 rounded-[0.15em] px-1"
        initial={false}
        animate={{
          clipPath: on ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
          opacity: on ? 1 : 0,
        }}
        transition={{
          clipPath: { duration: 0.7, ease: EASE },
          opacity: { duration: on ? 0.1 : 0.4 },
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/**
 * A range gauge
 */
function Gauge({ still }: { still: boolean }) {
  const [start, end] = GAUGE.band;
  const move = { duration: 1.2, ease: EASE, delay: 0.35 };

  return (
    <div className="relative my-1 h-2">
      <div className="bg-muted absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
      <div
        className="bg-success/35 absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
        style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
      />
      <motion.div
        className="absolute inset-0"
        initial={{ x: `${(still ? GAUGE.to : GAUGE.from) * 100}%` }}
        animate={{ x: `${GAUGE.to * 100}%` }}
        transition={move}
      >
        <motion.span
          className="bg-success ring-card absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
          initial={{ opacity: still ? 0 : 1 }}
          animate={{ opacity: 0 }}
          transition={move}
        />
        <motion.span
          className="bg-caution ring-card absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
          initial={{ opacity: still ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={move}
        />
      </motion.div>
    </div>
  );
}

function LabCard({ still }: { still: boolean }) {
  return (
    <div className="bg-popover flex flex-col gap-1.5 rounded-xl border p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">ALT</p>
          <p className="text-muted-foreground truncate text-xs">
            Alanine aminotransferase
          </p>
        </div>
        <motion.span
          className="bg-caution/15 text-caution rounded-pill shrink-0 px-2 py-0.5 text-xs font-medium"
          initial={{ opacity: still ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.3 }}
        >
          High
        </motion.span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-mono text-sm">90 IU/L</span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <TrendingDown className="size-3" />
          was 1001 IU/L on 8 Oct
        </span>
      </div>
      <Gauge still={still} />
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span>Typical adult range 4–56 IU/L</span>
        <span className="font-mono">p.2</span>
      </div>
    </div>
  );
}

function Explanation() {
  return (
    <div className="bg-popover flex flex-col gap-1.5 rounded-2xl border p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Logo className="text-muted-foreground size-3.5" />
        <p className="text-sm font-medium">ALT</p>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Alanine aminotransferase, an enzyme made mostly in the liver. Your
        report lists it with your liver tests <Citation page={2} />
      </p>
    </div>
  );
}

/** The answer appears a word at a time so its shown like its typing. */
function Answer() {
  const words = ANSWER.split(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">What is out of range?</p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {words.map((word, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 + index * WORD_STAGGER }}
          >
            {word}{" "}
          </motion.span>
        ))}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            delay: 0.5 + words.length * WORD_STAGGER,
          }}
        >
          <Citation page={2} />
        </motion.span>
      </p>
    </div>
  );
}

const ROWS = [
  { name: "Bilirubin", value: "17", unit: "µmol/L" },
  { name: "ALT", value: "90", unit: "IU/L" },
  { name: "AST", value: "70", unit: "IU/L" },
] as const;

/**
 * A short, looping preview of the viewer
 */
export function HeroPreview({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const visible = usePageVisible();
  const small = useMatchMedia(SMALL_SCREEN);
  const reduce = useReducedMotion() ?? false;

  const playing = useBeat(inView && visible && !reduce, small);
  const beat: Beat = reduce ? "range" : playing;

  const highlighted = reduce || beat === "highlight" || beat === "explain";

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "border-border/70 bg-card relative flex w-full flex-col overflow-hidden rounded-xl border shadow-sm select-none",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Logo className="text-muted-foreground size-3.5" />
        <span className="text-muted-foreground truncate font-mono text-xs">
          discharge-summary.pdf
        </span>
        <span className="text-muted-foreground ml-auto font-mono text-xs">
          2 / 3
        </span>
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Investigations
        </p>
        <TextBar className="w-[92%]" />
        <TextBar className="w-[74%]" />

        <div className="mt-1 flex flex-col">
          {ROWS.map((row) => (
            <div
              key={row.name}
              className="border-border/70 relative grid grid-cols-[1fr_auto_4.5rem] gap-x-4 border-b py-1.5 font-mono text-xs"
            >
              <span>
                {row.name === "ALT" ? (
                  <Highlighted on={highlighted}>{row.name}</Highlighted>
                ) : (
                  row.name
                )}
              </span>
              <span className="text-right">{row.value}</span>
              <span className="text-muted-foreground">{row.unit}</span>

              {row.name === "ALT" ? (
                <AnimatePresence>
                  {beat === "explain" ? (
                    <motion.div
                      key="explain"
                      {...card}
                      className="absolute top-[calc(100%+0.5rem)] left-0 z-10 w-72 max-w-[85%] font-sans"
                    >
                      <Explanation />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              ) : null}
            </div>
          ))}
        </div>

        <TextBar className="mt-1 w-[86%]" />
        <TextBar className="w-[60%]" />
      </div>

      {/* The rest of the page. The lab and chat cards go over it, so it has
          room for them without the table ever being covered. */}
      <div className="relative mx-4 mb-4 h-36">
        <div className="flex flex-col gap-2.5 px-1 pt-2">
          <TextBar className="w-[88%]" />
          <TextBar className="w-[94%]" />
          <TextBar className="w-[70%]" />
          <TextBar className="mt-3 w-[82%]" />
          <TextBar className="w-[56%]" />
        </div>

        <AnimatePresence>
          {beat === "range" ? (
            <motion.div
              key="range"
              {...card}
              initial={reduce ? false : card.initial}
              className="absolute inset-x-0 bottom-0"
            >
              <LabCard still={reduce} />
            </motion.div>
          ) : null}
          {beat === "ask" ? (
            <motion.div
              key="ask"
              {...card}
              className="bg-popover absolute inset-x-0 bottom-0 rounded-xl border p-3 shadow-sm"
            >
              <Answer />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
