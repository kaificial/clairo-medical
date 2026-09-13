import type { Analyte, ReferenceRange } from "./types";
import { normalizeUnit } from "./values";

/**
 * Broad adult reference ranges, only used when the report doesn't print its
 * own. Each is wide enough to cover the common published adult intervals, so we
 * only call something out of range when most labs would too. Tests whose normal
 * range depends on things the report may not say (random glucose, lipids
 * against cardiac risk, sex specific hormones) are left out on purpose.
 */
const ANALYTES: readonly Analyte[] = [
  {
    key: "lactate",
    label: "Lactate",
    name: "Lactate",
    aliases: ["lactate", "lactic acid", "venous lactate"],
    ranges: { "mmol/l": { low: 0.5, high: 2.2 } },
  },
  {
    key: "alt",
    label: "ALT",
    name: "Alanine aminotransferase",
    aliases: [
      "alt",
      "alt sgpt",
      "sgpt",
      "alanine aminotransferase",
      "alanine transaminase",
    ],
    ranges: { "u/l": { low: 4, high: 56 } },
  },
  {
    key: "ast",
    label: "AST",
    name: "Aspartate aminotransferase",
    aliases: [
      "ast",
      "ast sgot",
      "sgot",
      "aspartate aminotransferase",
      "aspartate transaminase",
    ],
    ranges: { "u/l": { low: 5, high: 40 } },
  },
  {
    key: "alp",
    label: "ALP",
    name: "Alkaline phosphatase",
    aliases: ["alp", "alk phos", "alkaline phosphatase"],
    ranges: { "u/l": { low: 30, high: 147 } },
  },
  {
    key: "bilirubin",
    label: "Bilirubin",
    name: "Total bilirubin",
    aliases: [
      "bilirubin",
      "total bilirubin",
      "bilirubin total",
      "t bili",
      "tbili",
    ],
    ranges: {
      "umol/l": { low: 3, high: 21 },
      "mg/dl": { low: 0.1, high: 1.2 },
    },
  },
  {
    key: "albumin",
    label: "Albumin",
    name: "Albumin",
    aliases: ["albumin"],
    ranges: { "g/l": { low: 34, high: 54 }, "g/dl": { low: 3.4, high: 5.4 } },
  },
  {
    key: "total-protein",
    label: "Total protein",
    name: "Total protein",
    aliases: ["total protein", "protein total"],
    ranges: { "g/l": { low: 60, high: 83 }, "g/dl": { low: 6, high: 8.3 } },
  },
  {
    key: "creatinine",
    label: "Creatinine",
    name: "Creatinine",
    aliases: ["creatinine", "creat"],
    ranges: {
      "umol/l": { low: 45, high: 115 },
      "mg/dl": { low: 0.5, high: 1.3 },
    },
  },
  {
    key: "urea",
    label: "Urea",
    name: "Urea",
    aliases: ["urea"],
    ranges: { "mmol/l": { low: 2.1, high: 8.5 } },
  },
  {
    key: "bun",
    label: "BUN",
    name: "Blood urea nitrogen",
    aliases: ["bun", "blood urea nitrogen", "urea nitrogen"],
    ranges: { "mg/dl": { low: 6, high: 24 } },
  },
  {
    key: "egfr",
    label: "eGFR",
    name: "Estimated glomerular filtration rate",
    aliases: ["egfr", "estimated gfr", "gfr estimated"],
    ranges: { "ml/min/1.73m2": { low: 60 } },
  },
  {
    key: "sodium",
    label: "Sodium",
    name: "Sodium",
    aliases: ["sodium", "na"],
    ranges: {
      "mmol/l": { low: 135, high: 146 },
      "meq/l": { low: 135, high: 146 },
    },
  },
  {
    key: "potassium",
    label: "Potassium",
    name: "Potassium",
    aliases: ["potassium", "k"],
    ranges: {
      "mmol/l": { low: 3.5, high: 5.2 },
      "meq/l": { low: 3.5, high: 5.2 },
    },
  },
  {
    key: "chloride",
    label: "Chloride",
    name: "Chloride",
    aliases: ["chloride", "cl"],
    ranges: {
      "mmol/l": { low: 96, high: 106 },
      "meq/l": { low: 96, high: 106 },
    },
  },
  {
    key: "bicarbonate",
    label: "Bicarbonate",
    name: "Bicarbonate",
    aliases: ["bicarbonate", "hco3", "co2", "total co2", "tco2"],
    ranges: {
      "mmol/l": { low: 22, high: 30 },
      "meq/l": { low: 22, high: 30 },
    },
  },
  {
    key: "calcium",
    label: "Calcium",
    name: "Calcium",
    aliases: ["calcium", "total calcium", "ca"],
    ranges: {
      "mmol/l": { low: 2.1, high: 2.6 },
      "mg/dl": { low: 8.5, high: 10.5 },
    },
  },
  {
    key: "magnesium",
    label: "Magnesium",
    name: "Magnesium",
    aliases: ["magnesium"],
    ranges: {
      "mmol/l": { low: 0.7, high: 1.1 },
      "mg/dl": { low: 1.7, high: 2.4 },
    },
  },
  {
    key: "fasting-glucose",
    label: "Fasting glucose",
    name: "Fasting glucose",
    aliases: [
      "fasting glucose",
      "glucose fasting",
      "fasting blood glucose",
      "fasting plasma glucose",
      "fbg",
      "fpg",
    ],
    ranges: {
      "mmol/l": { low: 3.9, high: 5.5 },
      "mg/dl": { low: 70, high: 99 },
    },
  },
  {
    key: "hba1c",
    label: "HbA1c",
    name: "Hemoglobin A1c",
    aliases: [
      "hba1c",
      "a1c",
      "hemoglobin a1c",
      "haemoglobin a1c",
      "glycated hemoglobin",
      "glycated haemoglobin",
    ],
    ranges: { "%": { high: 5.6 } },
  },
  {
    key: "hemoglobin",
    label: "Hemoglobin",
    name: "Hemoglobin",
    aliases: ["hemoglobin", "haemoglobin", "hgb", "hb"],
    ranges: {
      "g/l": { low: 115, high: 175 },
      "g/dl": { low: 11.5, high: 17.5 },
    },
  },
  {
    key: "hematocrit",
    label: "Hematocrit",
    name: "Hematocrit",
    aliases: ["hematocrit", "haematocrit", "hct"],
    ranges: { "%": { low: 35, high: 50 }, "l/l": { low: 0.35, high: 0.5 } },
  },
  {
    key: "wbc",
    label: "White blood cells",
    name: "White blood cell count",
    aliases: [
      "wbc",
      "wbc count",
      "white blood cells",
      "white blood cell count",
      "white cell count",
      "leukocytes",
    ],
    ranges: { "10^9/l": { low: 4, high: 11 } },
  },
  {
    key: "platelets",
    label: "Platelets",
    name: "Platelet count",
    aliases: ["platelets", "platelet", "platelet count", "plt"],
    ranges: { "10^9/l": { low: 150, high: 450 } },
  },
  {
    key: "mcv",
    label: "MCV",
    name: "Mean corpuscular volume",
    aliases: ["mcv", "mean corpuscular volume", "mean cell volume"],
    ranges: { fl: { low: 80, high: 100 } },
  },
  {
    key: "tsh",
    label: "TSH",
    name: "Thyroid stimulating hormone",
    aliases: ["tsh", "thyroid stimulating hormone", "thyrotropin"],
    ranges: { "miu/l": { low: 0.4, high: 4.5 } },
  },
  {
    key: "inr",
    label: "INR",
    name: "International normalized ratio",
    aliases: ["inr", "pt inr", "international normalized ratio"],
    ranges: { "": { low: 0.8, high: 1.2 }, ratio: { low: 0.8, high: 1.2 } },
  },
  {
    key: "crp",
    label: "CRP",
    name: "C-reactive protein",
    aliases: ["crp", "c reactive protein"],
    ranges: { "mg/l": { high: 10 } },
  },
];

const SPECIMEN = /^(?:serum|plasma|blood|whole blood|s|p)\s+/;
const PARENTHETICAL = /\([^)]*\)/g;

/**
 * Discharge summaries often put vitals in the same table as lab results, and
 * "SpO2 96 %" looks just like a lab value. Vitals are left out by name.
 */
const VITAL_SIGN =
  /^(?:spo2|sp o2|o2 sat(?:uration)?|oxygen saturation|sats?|heart rate|hr|pulse|resp(?:iratory)? rate|rr|temp(?:erature)?|blood pressure|bp|weight|height|bmi|pain(?: score)?)$/;

const BY_ALIAS: ReadonlyMap<string, Analyte> = new Map(
  ANALYTES.flatMap((analyte) =>
    analyte.aliases.map((alias) => [alias, analyte] as const),
  ),
);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/**
 * A test name normalized two ways, as printed and with its parentheticals
 * dropped, so "ALT (SGPT)" also matches plain "alt".
 */
export function nameForms(name: string): string[] {
  const forms = [
    normalizeName(name),
    normalizeName(name.replace(PARENTHETICAL, " ")),
  ];
  return [...new Set(forms)].filter((form) => form.length > 0);
}

export function isVitalSign(name: string): boolean {
  return VITAL_SIGN.test(normalizeName(name));
}

export function findAnalyte(name: string): Analyte | null {
  for (const form of nameForms(name)) {
    const found =
      BY_ALIAS.get(form) ?? BY_ALIAS.get(form.replace(SPECIMEN, ""));
    if (found) return found;
  }
  return null;
}

/**
 * The typical range in the unit the report used. Without a range in that exact
 * unit we return null, because comparing mmol/L against a mg/dL range would be
 * worse than showing nothing.
 */
export function typicalRange(
  analyte: Analyte | null,
  unit: string | null,
): ReferenceRange | null {
  if (!analyte) return null;
  return analyte.ranges[unit === null ? "" : normalizeUnit(unit)] ?? null;
}
