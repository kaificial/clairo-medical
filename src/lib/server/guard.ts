import type { z } from "zod";

import {
  clientAddress,
  createRateLimiter,
  type RateLimitDecision,
  type RateLimiter,
  type RateLimitRule,
} from "./rate-limit";

const MINUTE = 60_000;

/**
 * Every AI route spends the app's provider quota so each has a per minute
 * burst limit and share 1 daily budget per caller.
 */
export const ROUTE_LIMITS = {
  chat: { limit: 20, windowMs: MINUTE },
  define: { limit: 40, windowMs: MINUTE },
  embed: { limit: 10, windowMs: MINUTE },
  labs: { limit: 6, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export const DAILY_LIMIT: RateLimitRule = {
  limit: 400,
  windowMs: 24 * 60 * MINUTE,
};

export type LimitedRoute = keyof typeof ROUTE_LIMITS;

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
      const decision = limiter.check(key, rule);
      if (!decision.allowed) return tooMany(decision, now());
    }
    return null;
  };
}

/** Shared by every route in this server instance. */
export const limitRequest = createGuard();

export type ReadResult<T> =
  { ok: true; data: T } | { ok: false; response: Response };

export interface ReadJsonOptions {
  maxBytes: number;
  /** Named in the 400 response so a caller can see what was expected. */
  shape: string;
}

/** Read, size check, parse and validate a JSON body before anything spends money. */
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  { maxBytes, shape }: ReadJsonOptions,
): Promise<ReadResult<T>> {
  const tooLarge = {
    ok: false,
    response: jsonError("That request is too large.", 413),
  } as const;

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge;

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: jsonError("Expected a JSON body.", 400) };
  }
  if (new TextEncoder().encode(text).length > maxBytes) return tooLarge;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError("Expected a JSON body.", 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError(`Expected ${shape}.`, 400) };
  }
  return { ok: true, data: parsed.data };
}
