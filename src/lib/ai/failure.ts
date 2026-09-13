/** What a route returns, and the reader is shown, when a provider call fails. */
interface AiFailure {
  status: number;
  message: string;
}

const MAX_DEPTH = 5;

/**
 * Collect messages and status codes from an error and the errors behind it.
 */
function collect(
  value: unknown,
  found: { text: string[]; statuses: number[] },
  seen = new Set<unknown>(),
  depth = 0,
): void {
  if (value == null || depth > MAX_DEPTH || seen.has(value)) return;
  seen.add(value);

  if (typeof value === "string") {
    found.text.push(value);
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  for (const key of ["message", "responseBody", "code", "name"]) {
    const field = record[key];
    if (typeof field === "string") found.text.push(field);
  }
  for (const key of ["statusCode", "status"]) {
    const field = record[key];
    if (typeof field === "number") found.statuses.push(field);
  }

  collect(record.cause, found, seen, depth + 1);
  collect(record.lastError, found, seen, depth + 1);
}

/**
 * Turn a thrown provider error into something worth showing the user
 */
export function describeAiFailure(cause: unknown): AiFailure {
  const found = { text: [] as string[], statuses: [] as number[] };
  collect(cause, found);

  const text = found.text.join(" ").toLowerCase();
  const status = (code: number) => found.statuses.includes(code);
  const says = (...phrases: string[]) =>
    phrases.some((phrase) => text.includes(phrase));

  if (status(429) || says("rate limit", "resource_exhausted", "quota")) {
    return {
      status: 429,
      message:
        "The AI provider is rate limiting requests. Wait a moment and try again.",
    };
  }

  if (
    status(401) ||
    status(403) ||
    says("api key not valid", "api_key_invalid", "invalid api key")
  ) {
    return {
      status: 502,
      message:
        "The AI provider rejected this app's key. Check GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  if (status(503) || says("high demand", "overloaded")) {
    return {
      status: 502,
      message: "The AI model is busy right now. Wait a minute and try again.",
    };
  }

  if (says("timeout", "timed out")) {
    return {
      status: 504,
      message: "The AI provider took too long to answer. Try again.",
    };
  }

  if (status(404)) {
    return {
      status: 502,
      message:
        'The configured model does not exist. AI_CHAT_MODEL and AI_EMBEDDING_MODEL take a "google/model" id such as "google/gemini-3.7-flash".',
    };
  }

  return {
    status: 502,
    message: "The AI provider could not complete this request. Try again.",
  };
}
