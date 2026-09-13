import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { modelIdSchema, parseEnv, usableModel } from "./env";

describe("parseEnv", () => {
  it("applies the default models", () => {
    const env = parseEnv({});

    expect(env.AI_CHAT_MODEL).toBe("google/gemini-3.7-flash");
    expect(env.AI_EMBEDDING_MODEL).toBe("google/gemini-embedding-001");
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
  });

  it("treats blank values as unset so defaults still apply", () => {
    const env = parseEnv({
      AI_CHAT_MODEL: "",
      GOOGLE_GENERATIVE_AI_API_KEY: "   ",
    });

    expect(env.AI_CHAT_MODEL).toBe("google/gemini-3.7-flash");
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
  });

  it("throws naming the variable that is malformed", () => {
    expect(() => parseEnv({ AI_CHAT_MODEL: "gemini" })).toThrow(
      /AI_CHAT_MODEL/,
    );
  });

  it("continues with a warning when validation is skipped", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = parseEnv({
      AI_CHAT_MODEL: "gemini",
      SKIP_ENV_VALIDATION: "1",
    });

    expect(env.AI_CHAT_MODEL).toBe("gemini");
    expect(env.AI_EMBEDDING_MODEL).toBe("google/gemini-embedding-001");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("ignores a skip flag set to false", () => {
    expect(() =>
      parseEnv({ AI_CHAT_MODEL: "gemini", SKIP_ENV_VALIDATION: "false" }),
    ).toThrow();
  });
});

describe("modelIdSchema", () => {
  it("accepts a provider/model id", () => {
    expect(modelIdSchema.safeParse("google/gemini-3.7-flash").success).toBe(
      true,
    );
  });

  it("rejects a key pasted into a model variable", () => {
    expect(modelIdSchema.safeParse("sk-ant-api03-notamodel").success).toBe(
      false,
    );
  });

  it("keeps the rejected value out of the message, in case it is a secret", () => {
    const result = modelIdSchema.safeParse("sk-ant-api03-notamodel");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(z.prettifyError(result.error)).not.toContain("notamodel");
  });
});

describe("usableModel", () => {
  it("returns the model name for a google model with a key", () => {
    expect(usableModel("google/gemini-3.7-flash", "key")).toBe(
      "gemini-3.7-flash",
    );
  });

  it("keeps a name that carries its own slashes", () => {
    expect(usableModel("google/models/gemini-3.7-flash", "key")).toBe(
      "models/gemini-3.7-flash",
    );
  });

  it("switches the feature off without a key", () => {
    expect(usableModel("google/gemini-3.7-flash", undefined)).toBeNull();
  });

  it("switches off a model no configured key answers for", () => {
    expect(usableModel("anthropic/claude-sonnet-5", "key")).toBeNull();
  });
});
