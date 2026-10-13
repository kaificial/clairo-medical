"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { translateAlong } from "@/components/iso/iso-kit";
import { follow, useLoop, useOnScreen } from "@/components/iso/motion";
import { cn } from "@/lib/utils";

import {
  answerPath,
  CHAT_LIFT,
  HEIGHT,
  markerX,
  P,
  POP_LIFT,
  stripePath,
  TRACK,
  WIDTH,
} from "./geometry";
import { BAND, BEATS, beatAt, CARDS, LOOP, startOf } from "./model";

/** Seconds into the loop: the moment shown before motion starts. */
const STILL = 11.6;
/** How quickly lifts and fades catch up with their targets, in seconds. */
const EASE = 0.14;
/** How far the card in focus rises off the panel, in world units. */
const FOCUS_LIFT = 3;
/** The card the story is about: ALT, the first one. */
const FOCUS = 0;
/** Each part starts or stops a beat early, so they hand over smoothly. */
const HANDOVER = 0.4;

const HIGHLIGHT = startOf("highlight");
const EXPLAIN = startOf("explain");
const RANGE = startOf("range");
const ASK = startOf("ask");
const RESET = LOOP - 0.6;

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
const within = (t: number, from: number, to: number) => t >= from && t < to;

interface Targets {
  stripe: number;
  pop: number;
  focus: number;
  slide: number;
  dot: number;
  chat: number;
  typed: number;
  chip: number;
}

/**
 * Lifts and fades ease toward their targets, so jumping to another beat
 * glides instead of snapping. The rest already follow smooth curves.
 */
const EASED = new Set<keyof Targets>(["pop", "focus", "dot", "chat"]);

/** What every moving part should be doing `t` seconds into the loop. */
function targetsAt(t: number): Targets {
  return {
    stripe:
      t < RESET ? smooth((t - HIGHLIGHT) / 0.8) : 1 - smooth((t - RESET) / 0.5),
    pop: within(t, EXPLAIN, RANGE - HANDOVER) ? 1 : 0,
    focus: within(t, RANGE, ASK - HANDOVER / 2) ? 1 : 0,
    slide: smooth((t - RANGE - HANDOVER) / 1.2),
    dot: t >= RANGE + 0.1 ? 1 : 0,
    chat: within(t, ASK, RESET) ? 1 : 0,
    typed: smooth((t - ASK - 0.6) / 1.8),
    chip: smooth((t - ASK - 2.4) / 0.3),
  };
}

const BAND_MIDDLE = (BAND[0] + BAND[1]) / 2;

/** Slides a gauge dot from the start of its track to `marker`. */
const dotShift = (marker: number) =>
  translateAlong(P, [markerX(marker) - TRACK[0], 0, 0]);

interface Frame {
  stripe: string;
  pop: string;
  popOpacity: string;
  focus: string;
  dot: string;
  dotOpacity: string;
  chat: string;
  chatOpacity: string;
  answer: string;
  chip: string;
  readout: string;
}

function frameOf(values: Targets, t: number): Frame {
  // The ALT dot sweeps out from the middle of the band to its true value.
  const goal = CARDS[FOCUS]!.marker;
  const marker = BAND_MIDDLE + (goal - BAND_MIDDLE) * values.slide;
  return {
    stripe: stripePath(values.stripe),
    pop: translateAlong(P, [0, 0, values.pop * POP_LIFT]),
    popOpacity: values.pop.toFixed(3),
    focus: translateAlong(P, [0, 0, values.focus * FOCUS_LIFT]),
    dot: dotShift(marker),
    dotOpacity: values.dot.toFixed(3),
    chat: translateAlong(P, [0, 0, (values.chat - 1) * CHAT_LIFT]),
    chatOpacity: values.chat.toFixed(3),
    answer: answerPath(values.typed),
    chip: values.chip.toFixed(3),
    readout: BEATS[beatAt(t)]!.readout,
  };
}

const INITIAL = frameOf(targetsAt(STILL), STILL);

export function SceneLive({
  label,
  shell,
  pane,
  print,
  shadow,
  panel,
  cards,
  dots,
  chat,
  chip,
  popover,
  className,
}: {
  label: string;
  shell: ReactNode;
  pane: ReactNode;
  print: ReactNode;
  shadow: ReactNode;
  panel: ReactNode;
  cards: ReactNode[];
  dots: ReactNode[];
  chat: ReactNode;
  chip: ReactNode;
  popover: ReactNode;
  className?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<SVGPathElement>(null);
  const shadowRef = useRef<SVGGElement>(null);
  const focusRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const chatRef = useRef<SVGGElement>(null);
  const answerRef = useRef<SVGPathElement>(null);
  const chipRef = useRef<SVGGElement>(null);
  const popoverRef = useRef<SVGGElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  const clock = useRef(STILL);
  const values = useRef<Targets>(targetsAt(STILL));
  const [beat, setBeat] = useState(beatAt(STILL));
  const [paused, setPaused] = useState(false);
  const onScreen = useOnScreen(stage);

  const tick = useCallback(
    (dt: number, calm: boolean) => {
      if (calm) clock.current = STILL;
      else if (!paused) clock.current = (clock.current + dt) % LOOP;
      const t = clock.current;

      const target = targetsAt(t);
      const current = values.current;
      for (const key of Object.keys(target) as (keyof Targets)[]) {
        current[key] = EASED.has(key)
          ? follow(current[key], target[key], dt, EASE, calm)
          : target[key];
      }

      // Write straight to the SVG rather than re-rendering every frame.
      const frame = frameOf(current, t);
      stripeRef.current?.setAttribute("d", frame.stripe);
      shadowRef.current?.setAttribute("opacity", frame.popOpacity);
      popoverRef.current?.setAttribute("transform", frame.pop);
      popoverRef.current?.setAttribute("opacity", frame.popOpacity);
      focusRef.current?.setAttribute("transform", frame.focus);
      dotRef.current?.setAttribute("transform", frame.dot);
      dotRef.current?.setAttribute("opacity", frame.dotOpacity);
      chatRef.current?.setAttribute("transform", frame.chat);
      chatRef.current?.setAttribute("opacity", frame.chatOpacity);
      answerRef.current?.setAttribute("d", frame.answer);
      chipRef.current?.setAttribute("opacity", frame.chip);
      const readout = readoutRef.current;
      if (readout && readout.textContent !== frame.readout) {
        readout.textContent = frame.readout;
      }

      const now = beatAt(t);
      setBeat((previous) => (previous === now ? previous : now));
      return !calm;
    },
    [paused],
  );

  const kick = useLoop(tick, onScreen);

  useEffect(() => {
    if (onScreen) kick();
  }, [paused, onScreen, kick]);

  function jump(by: number) {
    const next = (beat + by + BEATS.length) % BEATS.length;
    clock.current = BEATS[next]!.at + 0.01;
    setBeat(next);
    kick();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    const by = steps[event.key];
    if (!by) return;
    event.preventDefault();
    jump(by);
  }

  return (
    <figure className={cn("iso sc iso-figure", className)}>
      <div
        ref={stage}
        className="sc-stage"
        tabIndex={0}
        role="slider"
        aria-label={`${label} Use the arrow keys to step through it.`}
        aria-valuemin={1}
        aria-valuemax={BEATS.length}
        aria-valuenow={beat + 1}
        aria-valuetext={BEATS[beat]!.readout}
        onKeyDown={onKeyDown}
        onClick={() => jump(1)}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <svg
          className="iso-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          aria-hidden
          focusable="false"
        >
          {shell}
          {pane}
          <path ref={stripeRef} className="sc-stripe" d={INITIAL.stripe} />
          {print}
          <g ref={shadowRef} opacity={INITIAL.popOpacity}>
            {shadow}
          </g>
          {panel}
          {cards.map((card, index) => {
            const focused = index === FOCUS;
            return (
              <g
                key={index}
                ref={focused ? focusRef : undefined}
                transform={focused ? INITIAL.focus : undefined}
              >
                {card}
                <g
                  ref={focused ? dotRef : undefined}
                  transform={
                    focused ? INITIAL.dot : dotShift(CARDS[index]!.marker)
                  }
                  opacity={focused ? INITIAL.dotOpacity : undefined}
                >
                  {dots[index]}
                </g>
              </g>
            );
          })}
          <g
            ref={chatRef}
            transform={INITIAL.chat}
            opacity={INITIAL.chatOpacity}
          >
            {chat}
            <path
              ref={answerRef}
              className="iso-line sc-answer"
              data-tone="lo"
              d={INITIAL.answer}
            />
            <g ref={chipRef} opacity={INITIAL.chip}>
              {chip}
            </g>
          </g>
          <g
            ref={popoverRef}
            transform={INITIAL.pop}
            opacity={INITIAL.popOpacity}
          >
            {popover}
          </g>
        </svg>
      </div>

      {/* What the scene is showing right now, in a few words. */}
      <figcaption className="sc-caption" aria-hidden>
        <span className="sc-steps">
          {BEATS.map((entry, index) => (
            <span
              key={entry.name}
              className="sc-step"
              data-on={index === beat ? "" : undefined}
            />
          ))}
        </span>
        <span ref={readoutRef}>{INITIAL.readout}</span>
      </figcaption>
    </figure>
  );
}
