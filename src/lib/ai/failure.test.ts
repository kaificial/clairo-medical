import { describe, expect, it } from "vitest";

import { describeAiFailure, describeForLogs } from "./failure";

function providerError(body: string, statusCode: number): Error {
  const cause = Object.assign(new Error(body), {
    statusCode,
    responseBody: body,
  });
  return Object.assign(new Error("The request failed"), { statusCode, cause });
}

describe("describeAiFailure", () => {
  it("reads a rate limit from the status code", () => {
    expect(describeAiFailure(providerError("slow down", 429)).status).toBe(429);
  });

  it("points at the key when Google rejects it", () => {
    const failure = describeAiFailure(
      providerError(
        '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}',
        400,
      ),
    );

    expect(failure.message).toContain("rejected this app's credentials");
  });

  it("points at the credentials when Bedrock turns the role away", () => {
    const failure = describeAiFailure(
      providerError(
        '{"message":"User is not authorized to perform: bedrock:InvokeModel"}',
        403,
      ),
    );

    expect(failure.message).toContain("AWS role");
  });

  it("says cloud AI is paused when the budget kill switch has tripped", () => {
    const failure = describeAiFailure(
      providerError(
        '{"message":"User: arn:aws:sts::1:assumed-role/clairo-app-web/x is not authorized to perform: bedrock:InvokeModelWithResponseStream on resource: arn:aws:bedrock:us-east-1:1:inference-profile/y with an explicit deny in an identity-based policy"}',
        403,
      ),
    );

    expect(failure.status).toBe(503);
    expect(failure.message).toContain("paused");
    expect(failure.message).not.toContain("clairo-app-web");
  });

  it("names a Bedrock model id that does not exist", () => {
    const failure = describeAiFailure(
      providerError(
        '{"message":"The provided model identifier is invalid."}',
        400,
      ),
    );

    expect(failure.message).toContain("AI_CHAT_MODEL");
  });

  it("names a missing model without repeating what was configured", () => {
    const failure = describeAiFailure(
      providerError(
        '{"error":{"code":404,"message":"models/sk-secret-value is not found for API version v1beta","status":"NOT_FOUND"}}',
        404,
      ),
    );

    expect(failure.message).toContain("AI_CHAT_MODEL");
    expect(failure.message).not.toContain("sk-secret-value");
  });

  it("says the model is busy when retries ran out on an overloaded provider", () => {
    const retry = Object.assign(
      new Error("Failed after 3 attempts. Last error: The request failed"),
      {
        name: "AI_RetryError",
        lastError: providerError(
          "This model is currently experiencing high demand.",
          503,
        ),
      },
    );

    const failure = describeAiFailure(retry);
    expect(failure.status).toBe(502);
    expect(failure.message).toContain("busy");
  });

  it("names a timeout", () => {
    const failure = describeAiFailure(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    expect(failure.status).toBe(504);
  });

  it("falls back to something vague rather than leaking internals", () => {
    const failure = describeAiFailure(new Error("socket hang up"));

    expect(failure.status).toBe(502);
    expect(failure.message).not.toContain("socket");
  });

  it("survives an error that is not an error", () => {
    expect(describeAiFailure(undefined).status).toBe(502);
    expect(describeAiFailure("rate limit exceeded").status).toBe(429);
  });

  it("stops walking a cycle of causes", () => {
    const looped: { message: string; cause?: unknown } = { message: "loop" };
    looped.cause = looped;

    expect(describeAiFailure(looped).status).toBe(502);
  });
});

describe("describeForLogs", () => {
  it("keeps the report out of the logs", () => {
    const cause = Object.assign(new Error("Too many requests"), {
      name: "AI_APICallError",
      statusCode: 429,
      requestBodyValues: {
        messages: [{ role: "user", content: "Potassium 5.8 mmol/L, p.2" }],
      },
      responseBody: '{"message":"Rate exceeded for Potassium 5.8"}',
    });
    const retry = Object.assign(new Error("Failed after 3 attempts"), {
      name: "AI_RetryError",
      lastError: cause,
      text: "model output naming Potassium 5.8",
    });

    const line = describeForLogs(retry);

    expect(line).toContain("AI_RetryError < AI_APICallError");
    expect(line).toContain("status 429");
    expect(line).toContain("rate limiting");
    expect(line).not.toContain("Potassium");
  });

  it("copes with something that is not an error", () => {
    expect(describeForLogs(undefined)).toContain("undefined");
  });
});
