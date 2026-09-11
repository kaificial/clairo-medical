/** What the route returns and what the user is shown when a provider call fails. */
export interface AiFailure {
  status: number;
  message: string;
}

const MAX_DEPTH = 5;

function inspect(cause: unknown): { text: string; statuses: number[] } {
  const text: string[] = [];
  const statuses: number[] = [];
  let current: unknown = cause;

  for (let depth = 0; depth < MAX_DEPTH && current != null; depth += 1) {
    if (typeof current === "string") {
      text.push(current);
      break;
    }
    if (typeof current !== "object") break;

    const record = current as Record<string, unknown>;
    for (const key of ["message", "responseBody", "type", "code"]) {
      const value = record[key];
      if (typeof value === "string") text.push(value);
    }
    for (const key of ["statusCode", "status"]) {
      const value = record[key];
      if (typeof value === "number") statuses.push(value);
    }

    current = record.cause;
  }

  return { text: text.join(" ").toLowerCase(), statuses };
}

/**
 * Turn a thrown provider error into something worth showing to the user. The default is
 *  vague
 */
export function describeAiFailure(cause: unknown): AiFailure {
  const { text, statuses } = inspect(cause);

  if (
    text.includes("customer_verification_required") ||
    text.includes("credit card")
  ) {
    return {
      status: 402,
      message:
        "The AI provider will not serve this account yet: it wants a payment method on file. Add one in the provider's console, then try again.",
    };
  }

  if (statuses.includes(429) || text.includes("rate limit")) {
    return {
      status: 429,
      message:
        "The AI provider is rate limiting requests. Wait a moment and try again.",
    };
  }

  if (
    statuses.includes(401) ||
    text.includes("invalid api key") ||
    text.includes("unauthorized")
  ) {
    return {
      status: 502,
      message:
        "The AI provider rejected this app's key. Check the key for the provider this model belongs to.",
    };
  }

  if (text.includes("model_not_found")) {
    return {
      status: 502,
      message:
        'The configured model does not exist. AI_CHAT_MODEL and AI_EMBEDDING_MODEL take a "provider/model" id such as "google/gemini-3.7-flash".',
    };
  }

  return {
    status: 502,
    message: "The AI provider could not complete this request. Try again.",
  };
}
