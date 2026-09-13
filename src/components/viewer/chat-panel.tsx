"use client";

import { CornerDownLeft, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AiUnavailableError,
  askQuestion,
  failureMessage,
} from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/prompt";
import type { Search } from "@/lib/retrieval";

import { AnswerText } from "./answer-text";

const PASSAGE_COUNT = 6;

const SUGGESTIONS = [
  "What is out of the normal range?",
  "Summarise this in plain language",
  "What should I ask my doctor?",
] as const;

interface Turn {
  id: string;
  question: string;
  answer: string;
  status: "streaming" | "done" | "error";
  error?: string;
}

function toHistory(turns: readonly Turn[]): ChatMessage[] {
  return turns
    .filter((turn) => turn.status === "done")
    .flatMap((turn): ChatMessage[] => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer },
    ]);
}

export function ChatPanel({
  search,
  onJump,
}: {
  search: Search | null;
  onJump: (page: number) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const turnCounter = useRef(0);
  const busy = turns.some((turn) => turn.status === "streaming");
  const ready = search !== null && !busy;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns]);

  function update(id: string, change: (turn: Turn) => Turn) {
    setTurns((current) =>
      current.map((turn) => (turn.id === id ? change(turn) : turn)),
    );
  }

  async function ask(question: string) {
    if (!ready) return;

    turnCounter.current += 1;
    const id = `turn-${turnCounter.current}`;
    const history = toHistory(turns);

    setDraft("");
    setTurns((current) => [
      ...current,
      { id, question, answer: "", status: "streaming" },
    ]);

    try {
      const passages = (await search(question, PASSAGE_COUNT)).map(
        (hit) => hit.chunk,
      );

      await askQuestion({
        question,
        passages,
        history,
        onDelta: (delta) =>
          update(id, (turn) => ({ ...turn, answer: turn.answer + delta })),
      });

      update(id, (turn) => ({ ...turn, status: "done" }));
    } catch (cause) {
      if (cause instanceof AiUnavailableError) {
        setUnavailable(true);
        setTurns((current) => current.filter((turn) => turn.id !== id));
        return;
      }

      update(id, (turn) => ({
        ...turn,
        status: "error",
        error: failureMessage(
          cause,
          "That answer did not come through. Try asking again.",
        ),
      }));
    }
  }

  if (unavailable) return null;

  return (
    <section className="flex flex-col" aria-label="Ask about this report">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MessageCircle className="text-muted-foreground size-4" />
        <h2 className="text-sm font-medium">Ask about this report</h2>
      </header>

      <div
        ref={scrollRef}
        className="flex min-h-48 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:max-h-[60vh]"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm text-pretty">
              Answers come only from this document, and cite the page they came
              from.
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={!search}
                onClick={() => void ask(suggestion)}
                className="hover:bg-accent focus-visible:ring-ring/50 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          turns.map((turn) => (
            <article key={turn.id} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{turn.question}</p>
              {turn.answer.length > 0 ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <AnswerText text={turn.answer} onJump={onJump} />
                </p>
              ) : null}

              {turn.status === "streaming" && turn.answer.length === 0 ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : null}

              {turn.status === "error" ? (
                <p className="text-destructive text-sm" role="alert">
                  {turn.error}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const question = draft.trim();
          if (question) void ask(question);
        }}
      >
        <input
          value={draft}
          disabled={!ready}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={search ? "Ask a question" : "Open a report first"}
          aria-label="Ask a question about this report"
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="rounded-pill"
          disabled={!ready || draft.trim().length === 0}
          aria-label="Send question"
        >
          {busy ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
        </Button>
      </form>
    </section>
  );
}
