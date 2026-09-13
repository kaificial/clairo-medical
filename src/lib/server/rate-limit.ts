export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule): RateLimitDecision;
}

export interface RateLimiterOptions {
  now?: () => number;
  maxKeys?: number;
}

/**
 * Fixed window counters held in memory. Each server instance counts on its
 * own so this caps abuse per instance rather than globally
 */
export function createRateLimiter({
  now = Date.now,
  maxKeys = 10_000,
}: RateLimiterOptions = {}): RateLimiter {
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

  return {
    check(key, { limit, windowMs }) {
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
    },
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
