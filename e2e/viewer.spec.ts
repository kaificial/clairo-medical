import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

function ndjson(...events: object[]): string {
  return events.map((event) => `${JSON.stringify(event)}\n`).join("");
}

async function openExample(page: Page) {
  await page.goto("/viewer?example=1");
  await expect(page.getByText("3 of 7 tests outside the range")).toBeVisible({
    timeout: 30_000,
  });
}

const pageIndicator = (page: Page) => page.getByText(/^\d+ \/ 3$/);

/**
 * Only calls to our own API count. Model downloads from Hugging Face or
 * jsDelivr are fine, since they carry nothing from the report.
 */
function isAppApi(url: string): boolean {
  const { hostname, pathname } = new URL(url);
  return hostname === "localhost" && pathname.startsWith("/api/");
}

test("the landing page opens the example report", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /your medical report/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Try the example" }).click();
  await expect(page).toHaveURL(/\/viewer\?example=1$/);
  await expect(page.getByText("Example discharge summary")).toBeVisible();
});

test("lab results are read on the page and jump to their source", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isAppApi(request.url())) requests.push(request.url());
  });

  await openExample(page);
  await expect(page.getByRole("tab", { name: "Lab results" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const alt = page.getByRole("button", { name: /^ALT/ });
  await expect(alt).toContainText("90 IU/L");
  await expect(alt).toContainText("High");
  await expect(alt).toContainText("was 1001 IU/L on 8 Oct 2015");
  await expect(page.getByText(/typical adult range 4–56 IU\/L/i)).toBeVisible();

  await expect(pageIndicator(page)).toHaveText("1 / 3");
  await alt.click();
  await expect(pageIndicator(page)).toHaveText("2 / 3");

  // Reading the report and its lab results shouldn't touch our server at all.
  expect(requests).toEqual([]);
});

test("keyword search finds a passage and jumps to it", async ({ page }) => {
  await openExample(page);

  await page
    .getByRole("searchbox", { name: "Search this report" })
    .fill("tamsulosin");
  const result = page
    .getByRole("status", { name: /results/ })
    .getByRole("button")
    .first();
  await expect(result).toContainText("Tamsulosin");

  await result.click();
  await expect(pageIndicator(page)).not.toHaveText("1 / 3");
});

test("semantic search runs on this device and finds what keywords miss", async ({
  page,
}) => {
  test.slow();
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (isAppApi(request.url())) apiCalls.push(request.url());
  });

  await openExample(page);
  const search = page.getByRole("searchbox", { name: "Search this report" });
  const results = page.getByRole("status", { name: /results/ });

  await search.fill("trouble urinating");
  await expect(results).toContainText("Nothing in this report matches that.");

  await page.getByRole("button", { name: "Turn on semantic search" }).click();
  await expect(
    page.getByText("Semantic search on, running on this device"),
  ).toBeVisible({ timeout: 90_000 });

  await search.fill("trouble urinating ");
  await expect(results.getByRole("button").first()).toBeVisible();
  await expect(results).toContainText(/urinary|prostat|urine/i);

  expect(apiCalls).toEqual([]);
});

test("a streamed answer renders its citations as page jumps", async ({
  page,
}) => {
  let sent: { question?: string; passages?: unknown[] } = {};
  await page.route("**/api/chat", async (route) => {
    sent = route.request().postDataJSON() as typeof sent;
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: ndjson(
        { type: "delta", text: "Your ALT was 90 on the last test, " },
        { type: "delta", text: "above the usual range [p.2]." },
      ),
    });
  });

  await openExample(page);
  await page.getByRole("tab", { name: "Ask" }).click();
  await page
    .getByRole("button", { name: "What is out of the normal range?" })
    .click();

  const answer = page.getByRole("tabpanel", { name: "Ask" }).locator("article");
  await expect(answer).toContainText(
    "Your ALT was 90 on the last test, above the usual range",
  );
  // The chat once showed the raw NDJSON as the answer. Make sure the wire
  // format never leaks through again.
  await expect(answer).not.toContainText('"type"');
  expect(sent.question).toBe("What is out of the normal range?");
  expect(sent.passages?.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "p.2" }).click();
  await expect(pageIndicator(page)).toHaveText("2 / 3");
});

test("a rate limited answer says why it failed", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Too many requests. Try again in 42 seconds.",
      }),
    }),
  );

  await openExample(page);
  await page.getByRole("tab", { name: "Ask" }).click();
  await page.getByRole("textbox", { name: /ask a question/i }).fill("Hello?");
  await page.getByRole("button", { name: "Send question" }).click();

  await expect(
    page.getByRole("tabpanel", { name: "Ask" }).getByRole("alert"),
  ).toHaveText("Too many requests. Try again in 42 seconds.");
});

test("AI lab extraction reports what it found and what it dropped", async ({
  page,
}) => {
  await page.route("**/api/labs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: [
          {
            name: "Serum lactate",
            value: 6.1,
            valueText: "6.1",
            comparator: null,
            unit: null,
            date: null,
            printedRange: null,
            printedRangeText: null,
            printedFlag: null,
            page: 1,
            source: "model",
          },
        ],
        discarded: 2,
      }),
    }),
  );

  await openExample(page);
  await page.getByRole("button", { name: "Find results in the text" }).click();

  await expect(
    page.getByText(
      "AI found 1 result in the text. 2 more were not in the report and were dropped.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Read by AI and found on the page"),
  ).toBeVisible();
});

test("a scanned report is read with on-device OCR", async ({ page }) => {
  test.slow();
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (isAppApi(request.url())) apiCalls.push(request.url());
  });

  await page.goto("/viewer");
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "fixtures", "scanned-labs.pdf"));

  await expect(
    page.getByText(
      "This PDF is a scanned image, so it has no text to read yet.",
    ),
  ).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole("button", { name: "Read the text on this device" })
    .click();
  await expect(
    page.getByText(/was read from the image on this device/),
  ).toBeVisible({
    timeout: 120_000,
  });

  await expect(page.getByText(/tests outside the range/)).toBeVisible();
  const potassium = page.getByRole("button", { name: /^Potassium/ });
  await expect(potassium).toContainText("5.8");
  await expect(potassium).toContainText("High");

  // OCR happens in the browser, so nothing from the scanned page should reach
  // our server.
  expect(apiCalls).toEqual([]);
});

test("a file that is not a PDF is refused before anything reads it", async ({
  page,
}) => {
  await page.goto("/viewer");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That file is not a PDF.",
  );
});
