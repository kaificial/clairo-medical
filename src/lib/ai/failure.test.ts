import { describe, expect, it } from "vitest";

import { describeAiFailure } from "./failure";

function providerError(body: string, statusCode: number): Error {
  const cause = Object.assign(new Error(body), {
    statusCode,
    responseBody: body,
  });
  return Object.assign(new Error("The request failed"), {
    statusCode,
    type: "internal_server_error",
    cause,
  });
}

describe("describeAiFailure", () => {
  it("names an unpaid account, the one failure the reader can fix", () => {
    const failure = describeAiFailure(
      providerError(
        '{"error":{"message":"AI Gateway requires a valid credit card on file to service requests.","type":"customer_verification_required"}}',
        403,
      ),
    );

    expect(failure.status).toBe(402);
    expect(failure.message).toContain("payment method");
  });

  it("reads a rate limit from the status code", () => {
    expect(describeAiFailure(providerError("slow down", 429)).status).toBe(429);
  });

  it("points at the key when the provider rejects it", () => {
    expect(
      describeAiFailure(providerError("Unauthorized", 401)).message,
    ).toContain("rejected this app's key");
  });

  it("names a misconfigured model without repeating what was configured", () => {
    const failure = describeAiFailure(
      providerError(
        `{"error":{"message":"Model 'sk-secret-value' not found","type":"model_not_found"}}`,
        404,
      ),
    );

    expect(failure.message).toContain("AI_CHAT_MODEL");
    expect(failure.message).not.toContain("sk-secret-value");
  });

  it("falls back to something vague rather than leaking a stack", () => {
    const failure = describeAiFailure(new Error("socket hang up"));

    expect(failure.status).toBe(502);
    expect(failure.message).not.toContain("socket");
  });

  it("survives an error that is not an error", () => {
    expect(describeAiFailure(undefined).status).toBe(502);
    expect(describeAiFailure("customer_verification_required").status).toBe(
      402,
    );
  });

  it("stops walking a cycle of causes", () => {
    const looped: { message: string; cause?: unknown } = { message: "loop" };
    looped.cause = looped;

    expect(describeAiFailure(looped).status).toBe(502);
  });
});
