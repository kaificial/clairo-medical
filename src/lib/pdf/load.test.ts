import { describe, expect, it, vi } from "vitest";

import { extractFromPdf, type TextContentSource } from "./load";

function item(str: string, x: number, y: number, size = 10) {
  return {
    str,
    transform: [size, 0, 0, size, x, y],
    width: str.length * size * 0.5,
    height: size,
  };
}

function fakePdf(pages: ReturnType<typeof item>[][]): TextContentSource {
  return {
    numPages: pages.length,
    getPage: (pageNumber: number) =>
      Promise.resolve({
        getTextContent: () =>
          Promise.resolve({ items: pages[pageNumber - 1] ?? [] }),
      }),
  };
}

describe("extractFromPdf", () => {
  it("extracts every page in order", async () => {
    const document = await extractFromPdf(
      fakePdf([[item("PAGE ONE", 72, 700)], [item("PAGE TWO", 72, 700)]]),
    );

    expect(document.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(document.pages[0]?.blocks[0]?.text).toBe("PAGE ONE");
    expect(document.pages[1]?.blocks[0]?.text).toBe("PAGE TWO");
  });

  it("handles a document with no pages", async () => {
    await expect(extractFromPdf(fakePdf([]))).resolves.toEqual({ pages: [] });
  });

  it("drops entries that are not positioned text runs", async () => {
    const pdf: TextContentSource = {
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({
              items: [{ type: "beginMarkedContent" }, item("Sodium", 72, 700)],
            }),
        }),
    };

    const document = await extractFromPdf(pdf);
    expect(document.pages[0]?.blocks[0]?.text).toBe("Sodium");
  });

  it("reports progress per page", async () => {
    const onProgress = vi.fn();
    await extractFromPdf(fakePdf([[item("a", 0, 0)], [item("b", 0, 0)]]), {
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    const pdf = fakePdf([[item("a", 0, 0)], [item("b", 0, 0)]]);

    await expect(
      extractFromPdf(pdf, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toThrow();
  });
});
