import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { HeroMotif } from "@/components/hero-motif";
import { Reveal } from "@/components/motion-primitives";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "01",
    title: "Upload your PDF",
    body: "A lab panel, an imaging report, a discharge summary. It stays on your device until you choose otherwise.",
  },
  {
    n: "02",
    title: "Read it in plain language",
    body: "Highlight any term for an instant, sourced definition. Out-of-range values are called out, not buried.",
  },
  {
    n: "03",
    title: "Ask about your results",
    body: "What's abnormal here? What should I ask my doctor? Answers cite the exact page and section.",
  },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative flex min-h-[88vh] items-center overflow-hidden">
        <HeroMotif className="pointer-events-none absolute top-1/2 left-1/2 -z-10 aspect-square w-[max(1600px,140vw)] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-80 select-none" />
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="font-serif text-[clamp(2.75rem,7vw,4.75rem)] leading-[1.15] tracking-tight text-balance">
            Your medical report,{" "}
            <mark className="bg-highlight text-highlight-foreground rounded-[0.15em] box-decoration-clone px-1.5">
              in plain language
            </mark>
          </h1>

          <p className="text-muted-foreground mx-auto mt-6 max-w-md text-lg text-pretty">
            Highlight a term for a definition. Ask questions. Get answers with
            citations.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-pill">
              <Link href="/viewer">
                Start analysis
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-pill"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="how"
        className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-16"
      >
        <Reveal>
          <h2 className="font-serif text-2xl tracking-tight">How it works</h2>
          <ol className="border-border bg-border mt-8 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="bg-card flex flex-col gap-3 p-6">
                <span className="text-muted-foreground font-mono text-xs">
                  {step.n}
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
        className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-16"
      >
        <Reveal className="bg-card border-border flex flex-col gap-4 rounded-xl border p-8">
          <h2 className="font-serif text-2xl tracking-tight">
            You decide what leaves your machine
          </h2>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Cloud AI is the default for the best answers. Prefer full privacy?
            Switch on the in-browser model and your report is never uploaded —
            everything runs locally. Account sync is opt-in, one document at a
            time.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
        <Reveal>
          <p className="font-serif text-3xl tracking-tight text-balance">
            Bring the report you don't understand yet.
          </p>
          <Button asChild size="lg" className="rounded-pill mt-7">
            <Link href="/viewer">
              Start analysis
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </section>
    </main>
  );
}
