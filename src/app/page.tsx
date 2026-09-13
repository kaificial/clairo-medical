import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { DemoVideo } from "@/components/demo-video";
import { HeroMotif } from "@/components/hero-motif";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <Button asChild size="lg" className={cn("rounded-pill", className)}>
      <Link href="/viewer">
        Start analysis
        <ArrowRight />
      </Link>
    </Button>
  );
}

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-x-clip">
      <section>
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-12 px-6 pt-28 pb-16 sm:pt-36 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="max-w-xl">
            <div className="relative">
              <HeroMotif className="pointer-events-none absolute top-1/2 left-1/2 -z-10 aspect-square w-[max(900px,110vw)] max-w-none -translate-x-1/2 -translate-y-1/2 select-none lg:w-[1150px]" />
              <h1 className="font-serif text-[clamp(2.5rem,5.5vw,4.25rem)] leading-[1.15] tracking-tight text-balance">
                Your medical report,{" "}
                <mark className="bg-highlight text-highlight-foreground rounded-[0.15em] box-decoration-clone px-1.5">
                  in plain language
                </mark>
              </h1>
            </div>

            <p className="text-muted-foreground mt-6 max-w-md text-lg text-pretty">
              See which results are out of range. Highlight a term for a
              definition. Ask questions and get answers with citations.
            </p>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <StartButton />
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-pill"
              >
                <Link href="/viewer?example=1">Try the example</Link>
              </Button>
            </div>
          </div>

          <DemoVideo className="w-full lg:mt-3 lg:justify-self-end" />
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
              <li key={step.title} className="bg-card flex flex-col gap-3 p-6">
                <span className="text-muted-foreground font-mono text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-base font-medium">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.body}
                </p>
              </li>
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
            text recognition, and semantic search runs on your device too. Text
            leaves your device only when you ask the AI provider for something:
            a question, a definition, or a read of results written in sentences.
            Even then, only the passages that matter are sent.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <Reveal>
          <p className="font-serif text-3xl tracking-tight text-balance">
            Bring the report you don't understand yet.
          </p>
          <StartButton className="mt-7" />
        </Reveal>
      </section>
    </main>
  );
}
