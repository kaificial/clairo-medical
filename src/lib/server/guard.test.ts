import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createGuard, DAILY_LIMIT, readJson, ROUTE_LIMITS } from "./guard";
import { clientAddress, createRateLimiter } from "./rate-limit";

function request(ip: string, body?: string, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1`, ...headers },
    body,
  });
}

describe("createRateLimiter", () => {
  it("allows up to the limit in a window, then resets", () => {
    let time = 0;
    const limiter = createRateLimiter({ now: () => time });
    const rule = { limit: 2, windowMs: 1000 };

    expect(limiter.check("a", rule).allowed).toBe(true);
    expect(limiter.check("a", rule)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.check("a", rule).allowed).toBe(false);
    expect(limiter.check("b", rule).allowed).toBe(true);

    time = 1000;
    expect(limiter.check("a", rule).allowed).toBe(true);
  });

  it("stays within its key budget", () => {
    const limiter = createRateLimiter({ now: () => 0, maxKeys: 2 });
    const rule = { limit: 1, windowMs: 1000 };
    limiter.check("a", rule);
    limiter.check("b", rule);
    limiter.check("c", rule);
    expect(limiter.check("a", rule).allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  it("prefers the platform's real ip, then the first forwarded hop", () => {
    expect(clientAddress(request("1.1.1.1"))).toBe("1.1.1.1");
    expect(
      clientAddress(request("1.1.1.1", undefined, { "x-real-ip": "2.2.2.2" })),
    ).toBe("2.2.2.2");
    expect(clientAddress(new Request("http://localhost"))).toBe("unknown");
  });
});

describe("createGuard", () => {
  it("answers 429 with a retry hint once a caller exceeds a route's limit", async () => {
    const limit = createGuard(createRateLimiter({ now: () => 0 }), () => 0);

    for (let i = 0; i < ROUTE_LIMITS.labs.limit; i += 1) {
      expect(limit(request("3.3.3.3"), "labs")).toBeNull();
    }

    const refused = limit(request("3.3.3.3"), "labs");
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("retry-after")).toBe("60");
    expect(await refused?.json()).toEqual({
      error: "Too many requests. Try again in 60 seconds.",
    });

    expect(limit(request("4.4.4.4"), "labs")).toBeNull();
    expect(limit(request("3.3.3.3"), "chat")).toBeNull();
  });

  it("shares one daily budget across routes", () => {
    let time = 0;
    const limit = createGuard(
      createRateLimiter({ now: () => time }),
      () => time,
    );

    for (let i = 0; i < DAILY_LIMIT.limit; i += 1) {
      time = i * 60_000;
      expect(limit(request("5.5.5.5"), "define")).toBeNull();
    }

    time += 60_000;
    expect(limit(request("5.5.5.5"), "chat")?.status).toBe(429);
  });
});

describe("readJson", () => {
  const schema = z.object({ question: z.string().max(5) });
  const options = { maxBytes: 64, shape: "{ question }" };

  it("returns the validated body", async () => {
    const result = await readJson(
      request("1.1.1.1", JSON.stringify({ question: "hi" })),
      schema,
      options,
    );
    expect(result).toEqual({ ok: true, data: { question: "hi" } });
  });

  it("refuses oversized, malformed and mis-shaped bodies", async () => {
    const statuses = await Promise.all(
      [
        request("1.1.1.1", JSON.stringify({ question: "x".repeat(100) })),
        request("1.1.1.1", "{"),
        request("1.1.1.1", JSON.stringify({ question: "too long" })),
      ].map(async (input) => {
        const result = await readJson(input, schema, options);
        return result.ok ? 200 : result.response.status;
      }),
    );

    expect(statuses).toEqual([413, 400, 400]);
  });
});
