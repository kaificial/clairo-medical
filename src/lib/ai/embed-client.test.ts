import { afterEach, describe, expect, it, vi } from "vitest";

import { embedViaApi } from "./embed-client";
import { AiRequestFailedError, AiUnavailableError } from "./errors";

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("embedViaApi", () => {
  it("posts the values and returns the embeddings", async () => {
    const fetchMock = respondWith({
      embeddings: [[1, 0]],
      model: "openai/text-embedding-3-small",
      dimensions: 2,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await embedViaApi(["creatinine"]);

    expect(result.dimensions).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/embed",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ values: ["creatinine"] }),
      }),
    );
  });

  it("reports an unconfigured server distinctly, so callers can drop the feature", async () => {
    vi.stubGlobal("fetch", respondWith({ error: "no key" }, 503));

    await expect(embedViaApi(["x"])).rejects.toThrow(AiUnavailableError);
  });

  it("treats any other failure as an error worth surfacing", async () => {
    vi.stubGlobal("fetch", respondWith({ error: "upstream" }, 502));

    await expect(embedViaApi(["x"])).rejects.toThrow(AiRequestFailedError);
  });

  it("passes an abort signal through", async () => {
    const fetchMock = respondWith({
      embeddings: [],
      model: "m",
      dimensions: 0,
    });
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    await embedViaApi(["x"], controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/embed",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
