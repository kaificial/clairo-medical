import { expect, test } from "@playwright/test";

test("the health check says the server is up without revealing secrets", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body: unknown = await response.json();
  expect(body).toMatchObject({
    status: "ok",
    version: expect.any(String),
    features: { chat: expect.any(Boolean), cloudSearch: expect.any(Boolean) },
  });
  expect(JSON.stringify(body)).not.toMatch(/key|gemini|google/i);
});

test("every page is served with the security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("'wasm-unsafe-eval'");

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});
