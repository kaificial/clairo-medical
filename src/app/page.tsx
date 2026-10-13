import { PaperCta, PrimaryCta } from "@/components/cta";
import { AppScene } from "@/components/figures/scene/figure";
import { HeroMotif } from "@/components/hero-motif";
import {
  InViewMarker,
  PointerDrift,
  SpotlightItem,
} from "@/components/motion-bits";
import { PageTransition } from "@/components/page-transition";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

/**
 * The hero arrives in a short cascade: headline, then the line under it, then
 * the buttons.
 */
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

const STEPS = [
  {
    title: "Open your PDF",
    body: "A lab panel, an imaging report, a discharge summary. It is opened and read in your browser, never uploaded.",
  },
  {
    title: "See what's out of range",
    body: "Lab results are pulled from the report's tables and set against a range, with repeat tests shown as a trend.",
  },
  {
    title: "Ask about your results",
    body: "Highlight any term for a plain definition, or ask a question. Answers cite the page they came from.",
  },
] as const;

function StartButton({ className }: { className?: string }) {
  return (
    <PrimaryCta
      href="/viewer"
      transitionTypes={["nav-forward"]}
      label="Start analysis"
      className={className}
    />
  );
}

export default function Home() {
  return (
    <PageTransition>
      <main className="relative flex flex-1 flex-col overflow-x-clip">
        <section>
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-6 pt-28 pb-16 sm:pt-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] lg:gap-6">
            <div className="max-w-xl">
              <div className="relative">
                <PointerDrift className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
                  <HeroMotif className="aspect-square w-[max(900px,110vw)] max-w-none select-none lg:w-[1150px]" />
                </PointerDrift>
                <h1
                  className={cn(
                    "font-serif text-[clamp(2.5rem,5.5vw,4.25rem)] leading-[1.15] tracking-tight text-balance lg:text-[3.6rem]",
                    ENTER,
                  )}
                >
                  Your medical report,{" "}
                  <mark className="marker marker-swipe rounded-[0.15em] box-decoration-clone px-1.5">
                    in plain language
                  </mark>
                </h1>
              </div>

              <p
                className={cn(
                  "text-muted-foreground mt-5 max-w-sm text-base leading-relaxed text-pretty motion-safe:delay-150",
                  ENTER,
                )}
              >
                See which results are out of range. Highlight a term for a
                definition. Ask questions and get answers with citations.
              </p>

              <div
                className={cn(
                  "mt-9 flex flex-wrap items-center gap-4 motion-safe:delay-300",
                  ENTER,
                )}
              >
                <StartButton />
                <PaperCta
                  href="/viewer?example=1"
                  transitionTypes={["nav-forward"]}
                  label="Try the example"
                />
              </div>
            </div>

            <AppScene className={cn("w-full motion-safe:delay-500", ENTER)} />
          </div>
        </section>

        <section
          id="how"
          className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-12"
        >
          <Reveal>
            <h2 className="font-serif text-2xl tracking-tight">How it works</h2>
            <ol className="border-border bg-border mt-8 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <SpotlightItem
                  key={step.title}
                  className="bg-card flex flex-col gap-3 p-6"
                >
                  <span className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                    <span className="bg-foreground/20 group-hover/spot:bg-foreground/50 h-px w-4 origin-left transition-[width,background-color] duration-500 group-hover/spot:w-10" />
                  </span>
                  <h3 className="text-base font-medium transition-transform duration-500 group-hover/spot:translate-x-0.5">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </SpotlightItem>
              ))}
            </ol>
          </Reveal>
        </section>

        <section
          id="privacy"
          className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-12"
        >
          <Reveal className="bg-card border-border flex flex-col gap-4 rounded-xl border p-8">
            <h2 className="font-serif text-2xl tracking-tight">
              You decide what leaves your machine
            </h2>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Your PDF is opened, read, searched, and checked for out-of-range
              results inside your browser. Scanned pages are read with on-device
              text recognition, and semantic search runs on your device too.
              Text leaves your device only when you ask the AI provider for
              something: a question, a definition, or a read of results written
              in sentences. Even then, only the passages that matter are sent.
            </p>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
          <Reveal>
            <p className="font-serif text-3xl tracking-tight text-balance">
              Bring the report you{" "}
              <InViewMarker>don't understand yet.</InViewMarker>
            </p>
            <StartButton className="mt-7" />
          </Reveal>
        </section>
      </main>
    </PageTransition>
  );
}
