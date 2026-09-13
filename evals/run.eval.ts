import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { LOCAL_MODELS } from "@/lib/embeddings";
import {
  groundModelRows,
  normalizeName,
  readLabTables,
  toLabResults,
  type ModelLabRow,
} from "@/lib/labs";
import { toChunks, type Chunk } from "@/lib/pdf";
import {
  createMemoryVectorStore,
  denseStrategy,
  hybridSearch,
  indexDocument,
  lexicalStrategy,
  sectionStrategy,
  type Search,
  type Strategy,
} from "@/lib/retrieval";

import type { EvalReport, QuestionKind } from "./corpus/build";
import { REPORTS } from "./corpus/reports";
import {
  cloudEmbedder,
  localEmbedder,
  type EvalEmbedder,
} from "./lib/embedders";
import {
  classify,
  firstRelevantRank,
  percent,
  scoreRetrieval,
  type Classification,
  type RetrievalScores,
} from "./lib/metrics";

const TOP_K = 5;
const KINDS: QuestionKind[] = ["lexical", "paraphrase", "section"];
/**
 * A range no report in the corpus prints, used to check that a range the model
 * invents gets stripped.
 */
const INVENTED_RANGE = "917-983";

interface SystemResult {
  system: string;
  overall: RetrievalScores;
  byKind: Record<QuestionKind, RetrievalScores>;
  misses: string[];
}

interface LabsResult {
  overall: Classification;
  statusAccuracy: number;
  extraOrMisjudged: string[];
  missed: string[];
}

interface GroundingResult {
  genuineKept: number;
  genuineTotal: number;
  fabricatedDropped: number;
  fabricatedTotal: number;
  inventedRangesStripped: number;
  inventedRangesTotal: number;
}

const results: {
  retrieval: SystemResult[];
  labs?: LabsResult;
  grounding?: GroundingResult;
} = { retrieval: [] };

type BuildSearch = (report: EvalReport, chunks: Chunk[]) => Promise<Search>;

async function evaluateSystem(
  system: string,
  build: BuildSearch,
): Promise<SystemResult> {
  const ranks: { kind: QuestionKind; rank: number | null }[] = [];
  const misses: string[] = [];

  for (const report of REPORTS) {
    const chunks = toChunks(report.document);
    const search = await build(report, chunks);

    for (const { question, kind, relevant } of report.questions) {
      const rank = firstRelevantRank(await search(question, TOP_K), relevant);
      ranks.push({ kind, rank });
      if (rank === null) misses.push(`${report.id}: ${question}`);
    }
  }

  const ranksOf = (kind?: QuestionKind) =>
    ranks
      .filter((entry) => kind === undefined || entry.kind === kind)
      .map((entry) => entry.rank);

  return {
    system,
    overall: scoreRetrieval(ranksOf()),
    byKind: Object.fromEntries(
      KINDS.map((kind) => [kind, scoreRetrieval(ranksOf(kind))]),
    ) as Record<QuestionKind, RetrievalScores>,
    misses,
  };
}

function withSections(chunks: Chunk[], sections: boolean): Strategy[] {
  return sections ? [sectionStrategy(chunks)] : [];
}

function lexicalOnly(sections = false): BuildSearch {
  return async (_, chunks) =>
    hybridSearch([lexicalStrategy(chunks), ...withSections(chunks, sections)]);
}

function withDense(
  embedder: EvalEmbedder,
  hybrid: boolean,
  sections = false,
): BuildSearch {
  return async (report, chunks) => {
    const store = createMemoryVectorStore();
    const documentId = report.id;
    await indexDocument({
      store,
      documentId,
      chunks,
      embed: embedder.passages,
    });

    return hybridSearch([
      ...(hybrid ? [lexicalStrategy(chunks)] : []),
      denseStrategy({ store, documentId, embedQuery: embedder.query }),
      ...withSections(chunks, sections),
    ]);
  };
}

async function evaluateEmbedder(embedder: EvalEmbedder) {
  const name = embedder.name;
  results.retrieval.push(
    await evaluateSystem(`Dense · ${name}`, withDense(embedder, false)),
    await evaluateSystem(`Hybrid · BM25 + ${name}`, withDense(embedder, true)),
    await evaluateSystem(
      `Hybrid · BM25 + ${name} + sections`,
      withDense(embedder, true, true),
    ),
  );
}

const labKey = (name: string, value: number) =>
  `${normalizeName(name)}=${value}`;

/**
 * Compares what the table parser reads with the hand written gold results for
 * every report.
 */
function scoreLabs(): LabsResult {
  let matched = 0;
  let extra = 0;
  let statusRight = 0;
  const extraOrMisjudged: string[] = [];
  const missed: string[] = [];

  for (const report of REPORTS) {
    const gold = [...report.labs];

    for (const result of toLabResults(readLabTables(report.document))) {
      const index = gold.findIndex(
        (expected) =>
          labKey(expected.name, expected.value) ===
          labKey(result.name, result.value),
      );
      const expected = gold[index];
      if (!expected) {
        extra += 1;
        extraOrMisjudged.push(
          `${report.id}: ${result.name} ${result.valueText}`,
        );
        continue;
      }

      matched += 1;
      if (expected.status === result.status) {
        statusRight += 1;
      } else {
        extraOrMisjudged.push(
          `${report.id}: ${result.name} status ${result.status}, expected ${expected.status}`,
        );
      }
      gold.splice(index, 1);
    }

    missed.push(...gold.map((lab) => `${report.id}: ${lab.name} ${lab.value}`));
  }

  return {
    overall: classify(matched, extra, missed.length),
    statusAccuracy: matched === 0 ? 0 : statusRight / matched,
    extraOrMisjudged,
    missed,
  };
}

/**
 * Feeds every genuine row to the grounding step as if a model had returned it,
 * along with three fakes of each: a value nudged off what's printed, a test the
 * report never mentions, and a citation to the wrong page. Every genuine row
 * should survive and every fake should be dropped.
 */
function scoreGrounding(): GroundingResult {
  const score: GroundingResult = {
    genuineKept: 0,
    genuineTotal: 0,
    fabricatedDropped: 0,
    fabricatedTotal: 0,
    inventedRangesStripped: 0,
    inventedRangesTotal: 0,
  };

  for (const report of REPORTS) {
    const chunks = toChunks(report.document);
    const keeps = (row: ModelLabRow) =>
      groundModelRows([row], chunks).rows[0] ?? null;

    for (const row of readLabTables(report.document)) {
      const genuine: ModelLabRow = {
        name: row.name,
        value: row.valueText,
        unit: row.unit,
        referenceRange: row.printedRangeText,
        flag: null,
        date: row.date,
        page: row.page,
      };
      const fabrications: ModelLabRow[] = [
        { ...genuine, value: (row.value + 0.37).toFixed(2) },
        { ...genuine, name: "Ferritin" },
        { ...genuine, page: row.page === 1 ? 2 : 1 },
      ];

      score.genuineTotal += 1;
      if (keeps(genuine)) score.genuineKept += 1;

      score.fabricatedTotal += fabrications.length;
      score.fabricatedDropped += fabrications.filter(
        (fake) => !keeps(fake),
      ).length;

      score.inventedRangesTotal += 1;
      const invented = keeps({ ...genuine, referenceRange: INVENTED_RANGE });
      if (invented?.printedRange === null) score.inventedRangesStripped += 1;
    }
  }

  return score;
}

describe("retrieval", () => {
  it("BM25", async () => {
    results.retrieval.push(
      await evaluateSystem("BM25", lexicalOnly()),
      await evaluateSystem("BM25 + sections", lexicalOnly(true)),
    );
  });

  for (const model of Object.values(LOCAL_MODELS)) {
    it(`local ${model.label}`, async () => {
      await evaluateEmbedder(await localEmbedder(model));
    });
  }

  it("cloud Gemini (EVAL_CLOUD=1)", async () => {
    const embedder = cloudEmbedder("gemini-embedding-001");
    if (embedder) await evaluateEmbedder(embedder);
  });

  it("holds its floor", () => {
    const bm25 = results.retrieval.find((r) => r.system === "BM25");
    expect(bm25?.byKind.lexical.recallAt5).toBeGreaterThanOrEqual(0.85);

    const hybrid = results.retrieval
      .filter((r) => r.system.startsWith("Hybrid"))
      .map((r) => r.overall.recallAt5);
    expect(Math.max(...hybrid)).toBeGreaterThanOrEqual(0.85);
  });
});

describe("lab parsing", () => {
  it("reads the gold results and nothing else", () => {
    const labs = scoreLabs();
    results.labs = labs;

    expect(labs.overall.precision).toBeGreaterThanOrEqual(0.95);
    expect(labs.statusAccuracy).toBe(1);
  });
});

describe("grounding", () => {
  it("keeps genuine model rows and drops fabricated ones", () => {
    const grounding = scoreGrounding();
    results.grounding = grounding;

    expect(grounding.fabricatedDropped).toBe(grounding.fabricatedTotal);
    expect(grounding.inventedRangesStripped).toBe(
      grounding.inventedRangesTotal,
    );
    expect(grounding.genuineKept).toBe(grounding.genuineTotal);
  });
});

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function table(header: string[], align: string[], rows: string[][]): string {
  return [header, align, ...rows]
    .map((cells) => `| ${cells.join(" | ")} |`)
    .join("\n");
}

function retrievalSection(): string {
  const allQuestions = REPORTS.flatMap((report) => report.questions);
  const counts = KINDS.map(
    (kind) =>
      `${allQuestions.filter((question) => question.kind === kind).length} ${kind}`,
  ).join(", ");
  const best = [...results.retrieval].sort(
    (a, b) => b.overall.mrr - a.overall.mrr,
  )[0];

  const rows = results.retrieval.map(({ system, overall, byKind }) => [
    system,
    percent(overall.recallAt1),
    percent(overall.recallAt3),
    percent(overall.recallAt5),
    overall.mrr.toFixed(3),
    percent(byKind.lexical.recallAt5),
    percent(byKind.paraphrase.recallAt5),
    percent(byKind.section.recallAt5),
  ]);

  return [
    `${allQuestions.length} questions over ${REPORTS.length} reports (${counts}). A hit is any top ${TOP_K} chunk containing an expected phrase.`,
    "",
    table(
      [
        "System",
        "R@1",
        "R@3",
        "R@5",
        "MRR",
        "Lexical R@5",
        "Paraphrase R@5",
        "Section R@5",
      ],
      ["---", "--:", "--:", "--:", "--:", "--:", "--:", "--:"],
      rows,
    ),
    "",
    best
      ? `Best by MRR: **${best.system}**. Its misses:\n\n${bullets(best.misses) || "- none"}`
      : "",
  ].join("\n");
}

function labsSection({
  overall,
  statusAccuracy,
  extraOrMisjudged,
  missed,
}: LabsResult): string {
  return [
    table(
      ["Precision", "Recall", "F1", "Status accuracy"],
      ["--:", "--:", "--:", "--:"],
      [
        [
          percent(overall.precision),
          percent(overall.recall),
          percent(overall.f1),
          percent(statusAccuracy),
        ],
      ],
    ),
    "",
    `${overall.truePositives} results read correctly, ${overall.falsePositives} extra, ${overall.falseNegatives} missed.`,
    "",
    extraOrMisjudged.length > 0
      ? `Extra or misjudged:\n\n${bullets(extraOrMisjudged)}`
      : "Nothing extra or misjudged.",
    "",
    missed.length > 0 ? `Missed:\n\n${bullets(missed)}` : "Nothing missed.",
  ].join("\n");
}

function groundingSection(grounding: GroundingResult): string {
  const ratio = (kept: number, total: number) => `${kept}/${total}`;
  return [
    table(
      [
        "Genuine rows kept",
        "Fabricated rows dropped",
        "Invented ranges stripped",
      ],
      ["--:", "--:", "--:"],
      [
        [
          ratio(grounding.genuineKept, grounding.genuineTotal),
          ratio(grounding.fabricatedDropped, grounding.fabricatedTotal),
          ratio(
            grounding.inventedRangesStripped,
            grounding.inventedRangesTotal,
          ),
        ],
      ],
    ),
    "",
    "Fabrications: a value nudged off what is printed, a test the report never mentions, and a citation to a page that does not hold the result.",
  ].join("\n");
}

afterAll(() => {
  const markdown = [
    "# Evaluation results",
    "",
    "Generated by `pnpm eval` from the synthetic reports in `evals/corpus`. Do not edit by hand.",
    "",
    "## Retrieval",
    "",
    retrievalSection(),
    "",
    "## Lab parsing",
    "",
    results.labs ? labsSection(results.labs) : "",
    "",
    "## Grounding of model output",
    "",
    results.grounding ? groundingSection(results.grounding) : "",
    "",
  ].join("\n");

  writeFileSync(join(process.cwd(), "evals", "results.md"), markdown);
});
