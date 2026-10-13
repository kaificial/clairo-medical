"use client";

import { parseCitations } from "@/lib/ai/citations";

/**
 * Shows an answer with every [p.N] citation turned into a small button.
 * Clicking one jumps the viewer to that page, so the reader can check the claim
 * against their own report.
 */
export function AnswerText({
  text,
  onJump,
}: {
  text: string;
  onJump: (page: number) => void;
}) {
  return (
    <>
      {parseCitations(text).map((part, index) =>
        part.kind === "citation" ? (
          <button
            key={`${part.page}-${index}`}
            type="button"
            onClick={() => onJump(part.page)}
            className="text-foreground hover:bg-highlight hover:text-highlight-foreground hover:border-highlight focus-visible:ring-ring/50 mx-0.5 inline-block rounded border px-1 align-baseline font-mono text-[0.7rem] transition-[background-color,color,border-color,translate] duration-200 outline-none hover:-translate-y-px focus-visible:ring-2 active:translate-y-0"
          >
            p.{part.page}
          </button>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
