import { describe, expect, it } from "vitest";

import { chooseProvider, modelName, modelProvider } from "./provider";

const none = { google: false };

describe("modelProvider and modelName", () => {
  it("splits a provider/model id", () => {
    expect(modelProvider("google/gemini-3.7-flash")).toBe("google");
    expect(modelName("google/gemini-3.7-flash")).toBe("gemini-3.7-flash");
  });

  it("keeps a name that carries its own slashes", () => {
    expect(modelName("google/models/gemini-3.7-flash")).toBe(
      "models/gemini-3.7-flash",
    );
  });
});

describe("chooseProvider", () => {
  it("uses the Google key for a google model", () => {
    expect(chooseProvider("google/gemini-3.7-flash", { google: true })).toBe(
      "google",
    );
    expect(
      chooseProvider("google/gemini-embedding-001", { google: true }),
    ).toBe("google");
  });

  it("reports that nothing serves the model when the key is missing", () => {
    expect(chooseProvider("google/gemini-3.7-flash", none)).toBeNull();
  });

  it("refuses a model no configured key answers for", () => {
    expect(
      chooseProvider("anthropic/claude-sonnet-5", { google: true }),
    ).toBeNull();
    expect(
      chooseProvider("openai/text-embedding-3-small", { google: true }),
    ).toBeNull();
  });

  it("refuses a bare model name, which names no provider to bill", () => {
    expect(chooseProvider("gemini-3.7-flash", { google: true })).toBeNull();
  });
});
