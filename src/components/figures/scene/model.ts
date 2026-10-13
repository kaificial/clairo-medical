import {
  groupSeries,
  isOutOfRange,
  rangeScale,
  STATUS_LABEL,
  toLabResults,
  withUnit,
  type LabRow,
} from "@/lib/labs";

/**
 * Results from page 2 of the bundled example report, as the table reader
 * returns them. The cards run them through the same code as the viewer's lab
 * panel, so every value and gauge position is one the app would show.
 */
const PRINTED: ReadonlyArray<[string, string, string]> = [
  ["ALT", "1001", "08 - Oct - 2015"],
  ["AST", "850", "08 - Oct - 2015"],
  ["Bilirubin", "24", "08 - Oct - 2015"],
  ["ALT", "90", "14 - Oct - 2015"],
  ["AST", "70", "14 - Oct - 2015"],
  ["Bilirubin", "17", "14 - Oct - 2015"],
];

const UNITS: Record<string, string> = {
  ALT: "IU/L",
  AST: "IU/L",
  Bilirubin: "umol/L",
};

const ROWS: LabRow[] = PRINTED.map(([name, valueText, date]) => ({
  name,
  value: Number(valueText),
  valueText,
  comparator: null,
  unit: UNITS[name] ?? null,
  date,
  printedRange: null,
  printedRangeText: null,
  printedFlag: null,
  page: 2,
  source: "table",
}));

/** Where the typical range sits on each card's gauge. */
export const BAND = [0.3, 0.7] as const;

interface Card {
  label: string;
  value: string;
  status: string;
  marker: number;
  flagged: boolean;
}

export const CARDS: Card[] = groupSeries(toLabResults(ROWS)).flatMap(
  (entry) => {
    const { latest } = entry;
    const scale = latest.range ? rangeScale(latest.value, latest.range) : null;
    if (!scale) return [];
    return [
      {
        label: entry.label,
        value: withUnit(latest.valueText, latest.unit),
        status: STATUS_LABEL[latest.status],
        marker: scale.marker,
        flagged: isOutOfRange(entry),
      },
    ];
  },
);

export const FLAGGED = CARDS.filter((card) => card.flagged).length;

/**
 * The loop, in order: open the page, highlight a term, read its explanation,
 * see the result against its range, ask a question.
 */
export const BEATS = [
  { name: "page", at: 0, readout: "Reading page 2 on this device" },
  { name: "highlight", at: 1, readout: "Highlight a term" },
  { name: "explain", at: 2, readout: "ALT · an enzyme made in the liver" },
  { name: "range", at: 5.4, readout: "ALT · 90 IU/L · High" },
  { name: "ask", at: 8.8, readout: "What is out of range? · p.2" },
] as const;

export const LOOP = 13;

type BeatName = (typeof BEATS)[number]["name"];

/** When a beat starts, in seconds into the loop. */
export function startOf(name: BeatName): number {
  return BEATS.find((beat) => beat.name === name)!.at;
}

/** Which beat is playing `t` seconds into the loop. */
export function beatAt(t: number): number {
  const time = ((t % LOOP) + LOOP) % LOOP;
  return Math.max(
    0,
    BEATS.findLastIndex((beat) => time >= beat.at),
  );
}
