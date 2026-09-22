import type { z } from "zod";

const MINUTE = 60_000;

interface RateLimitRule {
  limit: number;
  windowMs: number;
}

interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

type RateLimiter = (key: string, rule: RateLimitRule) => RateLimitDecision;

/**
 * Every AI route spends our provider quota, so each gets its own per minute
 * limit and all of them share one daily budget per caller. Definitions are
 * quick and frequent; lab extraction is the expensive one.
 */
export const ROUTE_LIMITS = {
  chat: { limit: 20, windowMs: MINUTE },
  define: { limit: 40, windowMs: MINUTE },
  embed: { limit: 10, windowMs: MINUTE },
  labs: { limit: 6, windowMs: MINUTE },
  simplify: { limit: 40, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export const DAILY_LIMIT: RateLimitRule = {
  limit: 400,
  windowMs: 24 * 60 * MINUTE,
};

export type LimitedRoute = keyof typeof ROUTE_LIMITS;

/**
 * Simple fixed window counters kept in memory. Each server instance counts on
 * its own, so with several instances this limits abuse per instance rather than
 * globally. Good enough until there's a shared store.
 */
export function createRateLimiter({
  now = Date.now,
  maxKeys = 10_000,
}: { now?: () => number; maxKeys?: number } = {}): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function makeRoom(time: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= time) windows.delete(key);
    }
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
  }

  return (key, { limit, windowMs }) => {
    const time = now();
    let window = windows.get(key);

    if (!window || window.resetAt <= time) {
      if (!window && windows.size >= maxKeys) makeRoom(time);
      window = { count: 0, resetAt: time + windowMs };
      windows.set(key, window);
    }

    window.count += 1;
    return {
      allowed: window.count <= limit,
      limit,
      remaining: Math.max(0, limit - window.count),
      resetAt: window.resetAt,
    };
  };
}

export function clientAddress(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || "unknown";
}

export function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  return Response.json({ error: message }, { status, headers });
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function tooMany(decision: RateLimitDecision, now: number): Response {
  const seconds = Math.max(1, Math.ceil((decision.resetAt - now) / 1000));
  const wait =
    seconds < 120
      ? plural(seconds, "second")
      : seconds < 7200
        ? plural(Math.ceil(seconds / 60), "minute")
        : plural(Math.ceil(seconds / 3600), "hour");

  return jsonError(`Too many requests. Try again in ${wait}.`, 429, {
    "retry-after": String(seconds),
    "ratelimit-limit": String(decision.limit),
    "ratelimit-remaining": "0",
  });
}

/**
 * Returns a ready to send 429 when the caller is over a limit, or null to let
 * the request through.
 */
export function createGuard(
  limiter: RateLimiter = createRateLimiter(),
  now: () => number = Date.now,
) {
  return function limitRequest(
    request: Request,
    route: LimitedRoute,
  ): Response | null {
    const client = clientAddress(request);
    const checks: [string, RateLimitRule][] = [
      [`${route}:${client}`, ROUTE_LIMITS[route]],
      [`day:${client}`, DAILY_LIMIT],
    ];

    for (const [key, rule] of checks) {
      const decision = limiter(key, rule);
      if (!decision.allowed) return tooMany(decision, now());
    }
    return null;
  };
}

/**
 * One limiter for every route in this server instance, so the daily budget
 * really is shared between them.
 */
export const limitRequest = createGuard();

type ReadResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Reads the body a piece at a time and gives up as soon as it passes
 * `maxBytes`. Checking the content-length header alone isn't enough, because a
 * sender can leave it out and stream as much as the platform allows.
 */
async function readCapped(
  request: Request,
  maxBytes: number,
): Promise<string | "too large"> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return "too large";
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * Reads, size checks, parses and validates the body before anything reaches the
 * provider. A bad request should cost us nothing.
 */
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  {
    maxBytes,
    shape,
  }: {
    maxBytes: number;
    /**
     * Goes into the 400 message, so whoever sent a bad request can see what we
     * expected.
     */
    shape: string;
  },
): Promise<ReadResult<T>> {
  const tooLarge = {
    ok: false,
    response: jsonError("That request is too large.", 413),
  } as const;
  const malformed = {
    ok: false,
    response: jsonError("Expected a JSON body.", 400),
  } as const;

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge;

  let text: string;
  try {
    const body = await readCapped(request, maxBytes);
    if (body === "too large") return tooLarge;
    text = body;
  } catch {
    return malformed;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return malformed;
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError(`Expected ${shape}.`, 400) };
  }
  return { ok: true, data: parsed.data };
}
