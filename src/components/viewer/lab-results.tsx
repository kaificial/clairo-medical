"use client";

import {
  FlaskConical,
  Info,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  AiUnavailableError,
  failureMessage,
  readLabsWithAi,
} from "@/lib/ai/client";
import {
  formatDate,
  formatRange,
  groupSeries,
  isOutOfRange,
  labPassages,
  mergeRows,
  rangeScale,
  STATUS_LABEL,
  toLabResults,
  withUnit,
  type LabResult,
  type LabRow,
  type LabSeries,
  type LabStatus,
} from "@/lib/labs";
import type { Chunk } from "@/lib/pdf";
import { cn, pageList } from "@/lib/utils";

type ModelRead =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "done"; rows: LabRow[]; discarded: number }
  | { status: "unavailable" }
  | { status: "error"; message: string };

const TONE: Readonly<Record<LabStatus, string>> = {
  high: "bg-caution/15 text-caution",
  low: "bg-caution/15 text-caution",
  abnormal: "bg-caution/15 text-caution",
  normal: "bg-success/15 text-success",
  unknown: "bg-muted text-muted-foreground",
};

/**
 * Out of range tests go to the top, since that's usually what someone opens a
 * lab report to find. Within each group we keep the order the report printed
 * them in.
 */
function flaggedFirst(series: readonly LabSeries[]): LabSeries[] {
  return [
    ...series.filter(isOutOfRange),
    ...series.filter((entry) => !isOutOfRange(entry)),
  ];
}

function pagesOf(series: readonly LabSeries[]): string {
  const pages = series.flatMap((entry) =>
    entry.results.map((result) => result.page),
  );
  return pageList([...new Set(pages)].sort((a, b) => a - b));
}

function modelReadSummary(found: number, discarded: number): string {
  const summary =
    found === 0
      ? "AI found no further results in the text."
      : `AI found ${found} result${found === 1 ? "" : "s"} in the text.`;
  if (discarded === 0) return summary;

  const verb = discarded === 1 ? "was" : "were";
  return `${summary} ${discarded} more ${verb} not in the report and ${verb} dropped.`;
}

const percent = (fraction: number) => `${fraction * 100}%`;

export function LabResults({
  tableRows,
  chunks,
  aiEnabled,
  onJump,
}: {
  /**
   * Null until the PDF's text has been read, so we can say "Reading the report"
   * instead of "no results".
   */
  tableRows: readonly LabRow[] | null;
  chunks: readonly Chunk[] | null;
  aiEnabled: boolean;
  onJump: (page: number) => void;
}) {
  const [model, setModel] = useState<ModelRead>({ status: "idle" });

  const series = useMemo(() => {
    const rows = tableRows ?? [];
    const all = model.status === "done" ? mergeRows(rows, model.rows) : rows;
    return flaggedFirst(groupSeries(toLabResults(all)));
  }, [tableRows, model]);

  const flagged = series.filter(isOutOfRange).length;
  const passages = useMemo(() => labPassages(chunks ?? []), [chunks]);

  async function readWithAi() {
    setModel({ status: "reading" });
    try {
      const { rows, discarded } = await readLabsWithAi(passages);
      setModel({ status: "done", rows, discarded });
    } catch (cause) {
      if (cause instanceof AiUnavailableError) {
        setModel({ status: "unavailable" });
        return;
      }
      setModel({
        status: "error",
        message: failureMessage(
          cause,
          "Could not read results from the text. Try again.",
        ),
      });
    }
  }

  if (!tableRows) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Reading the report...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {series.length > 0 ? (
        <>
          <div className="border-b px-4 py-3">
            <p className="font-serif text-lg leading-snug tracking-tight">
              {flagged === 0
                ? `All ${series.length} tests in range`
                : `${flagged} of ${series.length} tests outside the range`}
            </p>
            <p className="text-muted-foreground text-xs">
              From {pagesOf(series)}. Select a test to see it in the report.
            </p>
          </div>

          <ul className="flex flex-col divide-y overflow-y-auto lg:max-h-[52vh]">
            {series.map((entry) => (
              <li key={entry.key}>
                <SeriesRow series={entry} onJump={onJump} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2 px-4 py-6">
          <FlaskConical className="text-muted-foreground size-5" />
          <p className="text-sm font-medium">No lab table found</p>
          <p className="text-muted-foreground text-sm text-pretty">
            Clairo reads results from tables on your device. This report has
            none it recognises
            {aiEnabled
              ? ", but results written into sentences can still be found with AI."
              : "."}
          </p>
        </div>
      )}

      <footer className="flex flex-col gap-3 border-t px-4 py-3">
        {series.some((entry) => entry.latest.basis === "typical") ? (
          <p className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              This report prints no ranges, so these are broad adult ranges.
              Your lab&apos;s own range always wins. Not a diagnosis.
            </span>
          </p>
        ) : null}

        {aiEnabled && passages.length > 0 ? (
          <ModelReadControl model={model} onRead={() => void readWithAi()} />
        ) : null}
      </footer>
    </div>
  );
}

function ModelReadControl({
  model,
  onRead,
}: {
  model: ModelRead;
  onRead: () => void;
}) {
  if (model.status === "unavailable") return null;

  if (model.status === "done") {
    return (
      <p className="text-muted-foreground flex gap-2 text-xs" role="status">
        <Logo className="mt-0.5 size-3.5 shrink-0" />
        <span>{modelReadSummary(model.rows.length, model.discarded)}</span>
      </p>
    );
  }

  const reading = model.status === "reading";

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="outline"
        size="xs"
        className="rounded-pill self-start"
        disabled={reading}
        onClick={onRead}
      >
        {reading ? <Loader2 className="animate-spin" /> : <Logo />}
        {reading ? "Reading..." : "Find results in the text"}
      </Button>
      <span className="text-muted-foreground text-xs text-pretty">
        Sends passages with numbers to the AI provider. Every value it returns
        is checked against your report before it is shown.
      </span>
      {model.status === "error" ? (
        <p className="text-destructive text-xs" role="alert">
          {model.message}
        </p>
      ) : null}
    </div>
  );
}

function Gauge({ series }: { series: LabSeries }) {
  const { latest } = series;
  if (!latest.range) return null;

  const scale = rangeScale(latest.value, latest.range);
  if (!scale) return null;

  const earlier = series.results
    .slice(0, -1)
    .flatMap((result) =>
      result.range ? (rangeScale(result.value, result.range) ?? []) : [],
    );
  const [start, end] = scale.band;

  return (
    <div className="relative my-1 h-2" aria-hidden>
      <div className="bg-muted absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
      <div
        className="bg-success/35 absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
        style={{ left: percent(start), width: percent(end - start) }}
      />
      {earlier.map((point, index) => (
        <span
          key={index}
          className="border-muted-foreground/60 bg-card absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ left: percent(point.marker) }}
        />
      ))}
      <span
        className={cn(
          "ring-card absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
          isOutOfRange(series) ? "bg-caution" : "bg-success",
        )}
        style={{ left: percent(scale.marker) }}
      />
    </div>
  );
}

function Trend({ series }: { series: LabSeries }) {
  const [first] = series.results;
  const { latest } = series;
  if (!first || series.results.length < 2) return null;

  const Icon = latest.value < first.value ? TrendingDown : TrendingUp;
  const when = formatDate(first.date);

  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs">
      <Icon className="size-3" />
      was {withUnit(first.valueText, first.unit)}
      {when ? ` on ${when}` : ""}
    </span>
  );
}

function rangeNote(result: LabResult): string {
  if (!result.range) return "No range to compare with";
  const range = formatRange(result.range, result.unit);
  return result.basis === "report"
    ? `Report's range ${range}`
    : `Typical adult range ${range}`;
}

function SeriesRow({
  series,
  onJump,
}: {
  series: LabSeries;
  onJump: (page: number) => void;
}) {
  const { latest } = series;
  const when = formatDate(latest.date);

  return (
    <button
      type="button"
      onClick={() => onJump(latest.page)}
      className="hover:bg-accent/60 focus-visible:ring-ring/50 flex w-full flex-col gap-1.5 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{series.label}</span>
          {series.name && series.name !== series.label ? (
            <span className="text-muted-foreground block truncate text-xs">
              {series.name}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "rounded-pill shrink-0 px-2 py-0.5 text-xs font-medium",
            TONE[latest.status],
          )}
        >
          {STATUS_LABEL[latest.status]}
        </span>
      </span>

      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-mono text-sm">
          {withUnit(latest.valueText, latest.unit)}
          {when ? (
            <span className="text-muted-foreground font-sans text-xs">
              {" "}
              · {when}
            </span>
          ) : null}
        </span>
        <Trend series={series} />
      </span>

      <Gauge series={series} />

      <span className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span>{rangeNote(latest)}</span>
        <span className="font-mono">p.{latest.page}</span>
      </span>

      {latest.conflict ? (
        <span className="text-caution text-xs">
          The report flags this, though its printed range says otherwise.
        </span>
      ) : null}
      {latest.doubtfulRange ? (
        <span className="text-caution text-xs">
          The printed range ({latest.doubtfulRange}) cannot be right for this
          test and was probably misread, so a typical range is shown instead.
          Check it on the page.
        </span>
      ) : null}
      {latest.source === "model" ? (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Logo className="size-3" />
          Read by AI and found on the page
        </span>
      ) : null}
    </button>
  );
}
