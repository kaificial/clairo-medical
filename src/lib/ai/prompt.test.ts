import { describe, expect, it } from "vitest";

import type { Chunk } from "@/lib/pdf";

import {
  buildChatPrompt,
  buildDefinitionPrompt,
  CHAT_INSTRUCTIONS,
  DEFINITION_INSTRUCTIONS,
  formatPassage,
  formatPassages,
} from "./prompt";

function chunk(
  id: string,
  text: string,
  page = 1,
  headings: string[] = [],
  endPage = page,
): Chunk {
  return { id, text, page, endPage, headings, kind: "prose" };
}

describe("formatPassage", () => {
  it("labels a passage with its number and page", () => {
    expect(formatPassage(chunk("p2#1", "ALT 1001 IU/L.", 2), 0)).toBe(
      "[1] (p.2)\nALT 1001 IU/L.",
    );
  });

  it("includes the heading trail when there is one", () => {
    const formatted = formatPassage(
      chunk("p2#1", "ALT 1001 IU/L.", 2, ["SUMMARY", "Investigations"]),
      1,
    );

    expect(formatted).toContain("[2] (p.2 · SUMMARY > Investigations)");
  });

  it("shows a page range for a passage that spans pages", () => {
    expect(formatPassage(chunk("p1#1", "text", 1, [], 2), 0)).toContain(
      "(p.1-2)",
    );
  });
});

describe("formatPassages", () => {
  it("numbers passages in the order given", () => {
    const out = formatPassages([
      chunk("a", "first", 1),
      chunk("b", "second", 2),
    ]);

    expect(out.indexOf("[1]")).toBeLessThan(out.indexOf("[2]"));
  });

  it("drops the weakest matches to stay under the budget", () => {
    const out = formatPassages(
      [chunk("a", "x".repeat(200), 1), chunk("b", "keep me out", 2)],
      220,
    );

    expect(out).not.toContain("keep me out");
  });

  it("keeps the best passage even when it alone exceeds the budget", () => {
    const out = formatPassages([chunk("a", "x".repeat(500), 1)], 100);
    expect(out).toContain("[1]");
  });

  it("returns nothing for no passages", () => {
    expect(formatPassages([])).toBe("");
  });
});

describe("buildChatPrompt", () => {
  it("puts the passages alongside the question", () => {
    const { messages } = buildChatPrompt({
      question: "What was my ALT?",
      passages: [chunk("p2#1", "ALT 1001 IU/L.", 2)],
    });

    const last = messages.at(-1);
    expect(last?.role).toBe("user");
    expect(last?.content).toContain("ALT 1001 IU/L.");
    expect(last?.content).toContain("Question: What was my ALT?");
  });

  it("says outright when retrieval found nothing", () => {
    const { messages } = buildChatPrompt({
      question: "What about my knee?",
      passages: [],
    });

    expect(messages.at(-1)?.content).toContain("No passages");
  });

  it("keeps prior turns ahead of the new question", () => {
    const { messages } = buildChatPrompt({
      question: "And the second one?",
      passages: [],
      history: [
        { role: "user", content: "What was my ALT?" },
        { role: "assistant", content: "It was 1001 IU/L [p.2]." },
      ],
    });

    expect(messages).toHaveLength(3);
    expect(messages[0]?.content).toBe("What was my ALT?");
  });

  it("carries the grounding rules", () => {
    const { instructions } = buildChatPrompt({ question: "?", passages: [] });

    expect(instructions).toBe(CHAT_INSTRUCTIONS);
    expect(instructions).toContain("Answer only from the passages");
    expect(instructions).toContain("[p.2]");
  });

  it("tells the model how to handle a prognosis question", () => {
    expect(CHAT_INSTRUCTIONS).toMatch(/prognosis|survival/i);
    expect(CHAT_INSTRUCTIONS).toContain("not a doctor");
  });
});

describe("buildDefinitionPrompt", () => {
  it("puts the highlighted text last, after the passages", () => {
    const { messages } = buildDefinitionPrompt({
      term: "Creatinine",
      passages: [chunk("p2#1", "Creatinine 1.8 mg/dL (H).", 2)],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toContain("Creatinine 1.8 mg/dL (H).");
    expect(messages[0]?.content.trimEnd()).toMatch(
      /Highlighted text: Creatinine$/,
    );
  });

  it("says outright when the report does not contain the term", () => {
    const { messages } = buildDefinitionPrompt({
      term: "Creatinine",
      passages: [],
    });

    expect(messages[0]?.content).toContain("no passage containing");
  });

  it("allows general vocabulary, unlike an answer about the report", () => {
    expect(DEFINITION_INSTRUCTIONS).toContain("dictionary entry");
    expect(DEFINITION_INSTRUCTIONS).toContain("diagnosis");
    expect(DEFINITION_INSTRUCTIONS).not.toBe(CHAT_INSTRUCTIONS);
  });

  it("keeps the context budget below the one a question gets", () => {
    const long = chunk("p1#1", "x".repeat(6_000));
    const { messages } = buildDefinitionPrompt({
      term: "x",
      passages: [long, chunk("p2#1", "second", 2)],
    });

    expect(messages[0]?.content).not.toContain("second");
  });
});
