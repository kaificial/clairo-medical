import type { Chunk } from "@/lib/pdf";

import type { Strategy } from "./search";

interface Intent {
  /** How a reader might phrase the question. */
  question: RegExp;
  /**
   * The headings that usually answer it, in the words a clinician would use.
   */
  sections: RegExp;
}

/**
 * Reports keep their answers under predictable headings that a patient would
 * never think to type. Nobody asks about the "IMPRESSION"; they ask what the
 * scan found overall. These patterns connect the two.
 */
const INTENTS: readonly Intent[] = [
  {
    question:
      /\b(?:overall|summar(?:y|ise|ize)|conclusion|bottom line|main (?:finding|problem)s?|what did (?:it|the \w+|they) (?:find|show|say)|what (?:was|were) (?:found|seen))\b/i,
    sections:
      /\b(?:impression|conclusions?|summary|assessment|diagnos[ie]s|opinion)\b/i,
  },
  {
    question:
      /\b(?:next|what should i|what do i do|plan|follow[- ]?up|recommend\w*|suggest\w*|advice|instructions?)\b/i,
    sections:
      /\b(?:plan|recommendations?|follow[- ]?up|instructions?|comments?|advice|disposition)\b/i,
  },
  {
    question:
      /\b(?:why (?:was|is|did|were)|reason|indication|what (?:was|is) (?:it|this) for)\b/i,
    sections:
      /\b(?:indications?|clinical (?:history|information|details)|history|reason for|presenting)\b/i,
  },
  {
    question:
      /\b(?:medicines?|medications?|drugs?|pills?|prescri\w*|tablets?)\b/i,
    sections: /\b(?:medications?|prescriptions?)\b/i,
  },
];

/**
 * Sends a question to the section that answers it. Every hit scores the same,
 * so in fusion this only votes, in reading order, for the sections whose
 * heading fits. The eval showed it fixed the summary questions that every model
 * had missed.
 */
export function sectionStrategy(chunks: readonly Chunk[]): Strategy {
  return async (query, limit) => {
    const wanted = INTENTS.filter((intent) => intent.question.test(query));
    if (wanted.length === 0) return [];

    return chunks
      .filter((chunk) =>
        chunk.headings.some((heading) =>
          wanted.some((intent) => intent.sections.test(heading)),
        ),
      )
      .slice(0, limit)
      .map((chunk) => ({ chunk, score: 1 }));
  };
}
