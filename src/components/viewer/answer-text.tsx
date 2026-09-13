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
            className="text-foreground hover:bg-accent mx-0.5 rounded border px-1 align-baseline font-mono text-[0.7rem]"
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
