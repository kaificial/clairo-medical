import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createEnv, env, EnvValidationError } from "./env";

const server = z.object({
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn"]).default("info"),
  OPTIONAL_TOKEN: z.string().optional(),
});
const client = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

function runtime(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: "postgres://localhost/clairo",
    LOG_LEVEL: undefined,
    OPTIONAL_TOKEN: undefined,
    NEXT_PUBLIC_SITE_URL: "https://clairo.app",
    ...overrides,
  };
}

describe("createEnv", () => {
  it("parses valid input and applies schema defaults", () => {
    const parsed = createEnv({ server, client, runtimeEnv: runtime() });

    expect(parsed.DATABASE_URL).toBe("postgres://localhost/clairo");
    expect(parsed.LOG_LEVEL).toBe("info");
    expect(parsed.OPTIONAL_TOKEN).toBeUndefined();
    expect(parsed.NEXT_PUBLIC_SITE_URL).toBe("https://clairo.app");
  });

  it("treats blank and whitespace-only strings as unset so defaults still apply", () => {
    const parsed = createEnv({
      server,
      client,
      runtimeEnv: runtime({ LOG_LEVEL: "", OPTIONAL_TOKEN: "   " }),
    });

    expect(parsed.LOG_LEVEL).toBe("info");
    expect(parsed.OPTIONAL_TOKEN).toBeUndefined();
  });

  it("throws with the offending variable name when a required var is missing", () => {
    const call = () =>
      createEnv({
        server,
        client,
        runtimeEnv: runtime({ DATABASE_URL: undefined }),
      });

    expect(call).toThrow(EnvValidationError);
    expect(call).toThrow(/DATABASE_URL/);
  });

  it("throws when a value does not match its schema", () => {
    const call = () =>
      createEnv({
        server,
        client,
        runtimeEnv: runtime({ LOG_LEVEL: "verbose" }),
      });

    expect(call).toThrow(EnvValidationError);
    expect(call).toThrow(/LOG_LEVEL/);
  });

  it("rejects a client var that is missing the NEXT_PUBLIC_ prefix", () => {
    const call = () =>
      createEnv({
        server,
        client: z.object({ SITE_URL: z.string() }),
        runtimeEnv: runtime(),
      });

    expect(call).toThrow(EnvValidationError);
    expect(call).toThrow(/SITE_URL/);
  });

  it("rejects a server var that carries the NEXT_PUBLIC_ prefix", () => {
    const call = () =>
      createEnv({
        server: z.object({ NEXT_PUBLIC_SECRET: z.string() }),
        client,
        runtimeEnv: runtime(),
      });

    expect(call).toThrow(EnvValidationError);
    expect(call).toThrow(/NEXT_PUBLIC_SECRET/);
  });

  it("passes non-parsing input through raw (with a warning) when skipValidation is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = createEnv({
      server,
      client,
      runtimeEnv: runtime({ DATABASE_URL: undefined, LOG_LEVEL: "nonsense" }),
      skipValidation: true,
    });

    expect(parsed.DATABASE_URL).toBeUndefined();
    expect(parsed.LOG_LEVEL).toBe("nonsense");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("still applies schema defaults under skipValidation when input parses", () => {
    const parsed = createEnv({
      server,
      client,
      runtimeEnv: runtime(),
      skipValidation: true,
    });

    expect(parsed.LOG_LEVEL).toBe("info");
    expect(parsed.DATABASE_URL).toBe("postgres://localhost/clairo");
  });

  it("returns a frozen object", () => {
    const parsed = createEnv({ server, client, runtimeEnv: runtime() });

    expect(Object.isFrozen(parsed)).toBe(true);
  });
});

describe("env", () => {
  it("reflects the ambient NODE_ENV (defaulting to development)", () => {
    expect(env.NODE_ENV).toBe(process.env.NODE_ENV ?? "development");
  });
});
