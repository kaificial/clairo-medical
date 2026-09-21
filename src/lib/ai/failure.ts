/**
 * The status our route returns and the message the reader sees when a provider
 * call fails.
 */
interface AiFailure {
  status: number;
  message: string;
}

const MAX_DEPTH = 5;

/**
 * The AI SDK wraps provider errors, sometimes a few layers deep, and a retry
 * error keeps the real failure in lastError rather than cause. Walk all of it
 * and collect every message and status code along the way.
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
 * Turns whatever the provider threw into a message the reader can act on: wait
 * and try again, or ask whoever runs the app to fix the key or the model.
 * Anything we don't recognise gets a vague message rather than leaking
 * internals.
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
        "The AI provider rejected this app's credentials. Check GOOGLE_GENERATIVE_AI_API_KEY or the AWS role.",
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

  if (status(404) || says("model identifier is invalid")) {
    return {
      status: 502,
      message:
        'The configured model does not exist. AI_CHAT_MODEL and AI_EMBEDDING_MODEL take "provider/model" ids such as "google/gemini-3.7-flash".',
    };
  }

  return {
    status: 502,
    message: "The AI provider could not complete this request. Try again.",
  };
}
