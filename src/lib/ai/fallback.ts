import { streamText, type LanguageModel } from "ai";

import { describeForLogs } from "./failure";
import type { ChatPrompt } from "./prompt";

export interface NamedModel {
  /** The configured id, used in logs so we can tell which provider failed. */
  id: string;
  model: LanguageModel;
}

function announce(failed: NamedModel, next: NamedModel, cause?: unknown) {
  const line = `[ai] ${failed.id} failed, trying ${next.id}`;
  if (cause === undefined) console.warn(line);
  else console.warn(`${line}. ${describeForLogs(cause)}`);
}

/**
 * Runs `run` with each model in turn until one succeeds. If the reader gave up
 * (the request was aborted) we stop at once rather than spend money on an
 * answer nobody is waiting for.
 */
export async function firstThatAnswers<T>(
  models: readonly NamedModel[],
  run: (model: NamedModel) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  for (const [index, current] of models.entries()) {
    const next = models[index + 1];
    try {
      return await run(current);
    } catch (cause) {
      if (next === undefined || signal?.aborted) throw cause;
      announce(current, next, cause);
    }
  }
  throw new Error("No chat model is configured.");
}

export interface AnswerStream {
  deltas: AsyncIterable<string>;
  /** An error the provider raised on the side, read once the text runs out. */
  failure: () => unknown;
}

async function firstText(
  iterator: AsyncIterator<string>,
): Promise<string | null> {
  for (;;) {
    const step = await iterator.next();
    if (step.done) return null;
    if (step.value.length > 0) return step.value;
  }
}

async function* startingWith(
  first: string,
  rest: AsyncIterator<string>,
): AsyncGenerator<string> {
  yield first;
  for (let step = await rest.next(); !step.done; step = await rest.next()) {
    yield step.value;
  }
}

async function* nothing(): AsyncGenerator<string> {}

/**
 * Streams an answer from the first model that manages to start one.
 *
 * A backup only gets a turn before the first word arrives. After that the
 * reader is already watching an answer appear, and swapping to a different
 * model halfway would glue two unrelated answers together. So a failure
 * midway ends the stream with an error event instead.
 */
export async function streamFirstThatAnswers(
  models: readonly NamedModel[],
  { instructions, messages }: ChatPrompt,
): Promise<AnswerStream> {
  for (const [index, current] of models.entries()) {
    const next = models[index + 1];

    // The AI SDK reports provider errors through onError and quietly ends the
    // text stream, so hold on to the error ourselves.
    let failure: unknown;
    const fail = (cause: unknown) => {
      failure = cause;
      console.error(
        `[ai] ${current.id} stream failed. ${describeForLogs(cause)}`,
      );
    };
    const result = streamText({
      model: current.model,
      instructions,
      messages,
      // A busy model is often still busy a second later. With a backup
      // waiting it's faster to move on than to retry.
      maxRetries: next === undefined ? 2 : 0,
      onError: ({ error }) => fail(error),
    });

    const iterator = result.textStream[Symbol.asyncIterator]();
    let first: string | null = null;
    try {
      first = await firstText(iterator);
    } catch (cause) {
      fail(cause);
    }

    if (first !== null) {
      return { deltas: startingWith(first, iterator), failure: () => failure };
    }
    if (failure === undefined || next === undefined) {
      return { deltas: nothing(), failure: () => failure };
    }
    announce(current, next);
  }
  return { deltas: nothing(), failure: () => undefined };
}
