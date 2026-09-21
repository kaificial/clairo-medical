import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  configuredProviders,
  modelChainSchema,
  modelIdSchema,
  parseEnv,
  usableModel,
  usableModels,
} from "./env";

const HAIKU = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

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

  it("accepts a chat model followed by a backup", () => {
    const env = parseEnv({
      AI_CHAT_MODEL: `google/gemini-3.7-flash, bedrock/${HAIKU}`,
    });

    expect(env.AI_CHAT_MODEL).toBe(`google/gemini-3.7-flash, bedrock/${HAIKU}`);
  });

  it("defaults the Bedrock region", () => {
    expect(parseEnv({}).BEDROCK_REGION).toBe("us-east-1");
  });

  it("rejects something that is not a role in AWS_ROLE_ARN", () => {
    expect(() => parseEnv({ AWS_ROLE_ARN: "clairo-app-web" })).toThrow(
      /AWS_ROLE_ARN/,
    );
  });

  it("accepts a role in AWS_ROLE_ARN", () => {
    const arn = "arn:aws:iam::844038766260:role/clairo-app-web";
    expect(parseEnv({ AWS_ROLE_ARN: arn }).AWS_ROLE_ARN).toBe(arn);
  });
});

describe("modelChainSchema", () => {
  it("accepts one model", () => {
    expect(modelChainSchema.safeParse("google/gemini-3.7-flash").success).toBe(
      true,
    );
  });

  it("rejects an empty entry in the list", () => {
    expect(
      modelChainSchema.safeParse("google/gemini-3.7-flash,,bedrock/x").success,
    ).toBe(false);
  });

  it("rejects a key pasted into the list", () => {
    expect(
      modelChainSchema.safeParse("google/gemini-3.7-flash,sk-ant-api03-key")
        .success,
    ).toBe(false);
  });
});

describe("configuredProviders", () => {
  it("turns Google on with a key", () => {
    expect(
      configuredProviders({ GOOGLE_GENERATIVE_AI_API_KEY: "key" }),
    ).toEqual({ google: true, bedrock: false });
  });

  it("turns Bedrock on with a Vercel role or a local profile", () => {
    expect(
      configuredProviders({ AWS_ROLE_ARN: "arn:aws:iam::1:role/r" }).bedrock,
    ).toBe(true);
    expect(configuredProviders({ AWS_PROFILE: "clairo" }).bedrock).toBe(true);
  });

  it("leaves both off with nothing set", () => {
    expect(configuredProviders({})).toEqual({ google: false, bedrock: false });
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
  const both = { google: true, bedrock: true };

  it("splits a google model into provider and name", () => {
    expect(usableModel("google/gemini-3.7-flash", both)).toEqual({
      id: "google/gemini-3.7-flash",
      provider: "google",
      name: "gemini-3.7-flash",
    });
  });

  it("splits a bedrock model into provider and name", () => {
    expect(usableModel(`bedrock/${HAIKU}`, both)).toEqual({
      id: `bedrock/${HAIKU}`,
      provider: "bedrock",
      name: HAIKU,
    });
  });

  it("keeps a name that carries its own slashes", () => {
    expect(usableModel("google/models/gemini-3.7-flash", both)?.name).toBe(
      "models/gemini-3.7-flash",
    );
  });

  it("switches the feature off when the provider is not configured", () => {
    expect(
      usableModel("google/gemini-3.7-flash", { bedrock: true }),
    ).toBeNull();
  });

  it("switches off a provider this app does not support", () => {
    expect(usableModel("anthropic/claude-sonnet-5", both)).toBeNull();
  });
});

describe("usableModels", () => {
  it("keeps the configured order", () => {
    const models = usableModels(`bedrock/${HAIKU}, google/gemini-3.7-flash`, {
      google: true,
      bedrock: true,
    });

    expect(models.map((model) => model.provider)).toEqual([
      "bedrock",
      "google",
    ]);
  });

  it("skips models the server cannot sign in to", () => {
    const models = usableModels(`bedrock/${HAIKU},google/gemini-3.7-flash`, {
      google: true,
    });

    expect(models.map((model) => model.id)).toEqual([
      "google/gemini-3.7-flash",
    ]);
  });

  it("returns nothing when no provider is configured", () => {
    expect(usableModels("google/gemini-3.7-flash", {})).toEqual([]);
  });
});
