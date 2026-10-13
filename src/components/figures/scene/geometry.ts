import {
  boxCorners,
  corners,
  cylinder,
  fitProjection,
  insetPlan,
  iso,
  onTop,
  pathOf,
  slabOf,
  topMatrix,
  type Flat,
  type Plan,
  type Point3,
} from "@/components/iso/iso-kit";

import { BAND, CARDS } from "./model";

/*
 * The viewer, laid flat on the bench and seen from the front right: the app
 * window, its header, the PDF on the left and the lab results on the right.
 * Text runs along x, and the top of the window is toward -y.
 */

export const WIDTH = 560;
export const HEIGHT = 350;

export const P = fitProjection(
  [
    ...boxCorners({ x: -150, y: -104, w: 300, d: 208, r: 0 }, -9, 0),
    [-112, -2, 24],
    [134, 62, 14],
  ],
  WIDTH,
  HEIGHT,
  { pad: 2, azimuth: 66, elevation: 46 },
);

export const at = (point: Point3): Flat => iso(point, P);
const solid = (plan: Plan, z: number, h: number, steps = 5, bevel = 0) =>
  slabOf(plan, z, h, P, steps, bevel);
const join = (paths: string[]) => paths.join("");
const bar = (y: number, from: number, to: number, z: number) =>
  onTop(
    [
      [from, y],
      [to, y],
    ],
    z,
    P,
  );
const text = (x: number, y: number, z: number) => topMatrix([x, y], z, P, "x");

/**
 * Lays the Clairo mark (drawn on a 24 unit grid) flat on a face, `size` world
 * units across, with its top left corner at (x, y).
 */
const logoAt = (x: number, y: number, z: number, size: number) =>
  `${topMatrix([x, y], z, P, "x")} scale(${(size / 24).toFixed(4)})`;

/* The window and its header */

const WINDOW: Plan = { x: -150, y: -104, w: 300, d: 208, r: 12 };
const HEADER: Plan = { x: -140, y: -97, w: 280, d: 18, r: 9 };
const START: Plan = { x: 94, y: -93, w: 40, d: 10, r: 5 };
const HEADER_TOP = 2.4;

export const WINDOW_ART = {
  halo: solid(WINDOW, -9, 9).fill,
  window: solid(WINDOW, -9, 9, 8, 1.4),
  feet: corners(WINDOW, 24).map(([x, y]) => cylinder(x, y, 6, -12, 3, P, 24)),
  header: solid(HEADER, 0, HEADER_TOP, 8, 0.5),
  logo: logoAt(-131.6, -92.6, HEADER_TOP, 9),
  brand: text(-120, -86.4, HEADER_TOP),
  nav: join([
    bar(-88, -26, -6, HEADER_TOP),
    bar(-88, 4, 18, HEADER_TOP),
    bar(-88, 28, 44, HEADER_TOP),
  ]),
  toggle: cylinder(82, -88, 3.2, HEADER_TOP, 0.6, P, 20),
  start: solid(START, HEADER_TOP, 1.4, 5, 0.3),
  startText: text(START.x + 5, START.y + 6.6, HEADER_TOP + 1.4),
};

/* The PDF pane on the left, with its toolbar and the page */

const PANE: Plan = { x: -140, y: -72, w: 178, d: 168, r: 8 };
const PANE_TOP = 1.2;
const TOOLBAR: Plan = { x: -136, y: -68, w: 170, d: 12, r: 6 };
const PAGE: Plan = { x: -120, y: -50, w: 136, d: 138, r: 2 };
const PAGE_TOP = PANE_TOP + 1.4;

/** The three table rows on the page, as the example report prints them. */
const TABLE = [
  { name: "Bilirubin", value: "17", unit: "µmol/L" },
  { name: "ALT", value: "90", unit: "IU/L" },
  { name: "AST", value: "70", unit: "IU/L" },
] as const;
const ROW_Y = (row: number) => -18 + row * 10;
const TERM_ROW = 1;

const pageBars = [
  [-30, -108, 4],
  [-26, -108, -28],
  [12, -108, -6],
  [16, -108, -40],
  [26, -108, 0],
  [30, -108, -14],
  [34, -108, -52],
  [46, -108, -2],
  [50, -108, -24],
  [60, -108, 2],
  [64, -108, -36],
  [74, -108, -10],
  [78, -108, -60],
] as const;

export const PANE_ART = {
  pane: solid(PANE, 0, PANE_TOP, 6),
  toolbar: solid(TOOLBAR, PANE_TOP, 0.8, 6),
  chevrons: join([
    onTop(
      [
        [-127, -64.5],
        [-129, -62],
        [-127, -59.5],
      ],
      PANE_TOP + 0.8,
      P,
    ),
    onTop(
      [
        [-104, -64.5],
        [-102, -62],
        [-104, -59.5],
      ],
      PANE_TOP + 0.8,
      P,
    ),
  ]),
  pageCount: text(-121, -60.6, PANE_TOP + 0.8),
  zoom: join([
    bar(-62, 4, 12, PANE_TOP + 0.8),
    bar(-62, 18, 28, PANE_TOP + 0.8),
  ]),
  page: solid(PAGE, PANE_TOP, PAGE_TOP - PANE_TOP, 2),
  heading: text(-108, -38.5, PAGE_TOP),
  bars: join(pageBars.map(([y, from, to]) => bar(y, from, to, PAGE_TOP))),
  rules: join([-23, -13, -3, 7].map((y) => bar(y, -110, 4, PAGE_TOP))),
  names: TABLE.map((row, index) => ({
    label: row.name,
    at: text(-108, ROW_Y(index) + 1.7, PAGE_TOP),
  })),
  values: TABLE.map((row, index) => ({
    label: row.value,
    at: text(-46, ROW_Y(index) + 1.7, PAGE_TOP),
  })),
  units: TABLE.map((row, index) => ({
    label: row.unit,
    at: text(-34, ROW_Y(index) + 1.7, PAGE_TOP),
  })),
};

/** The marker stroke over "ALT", `share` of the way across. */
export function stripePath(share: number) {
  if (share <= 0) return "";
  const y = ROW_Y(TERM_ROW);
  const x0 = -110;
  const x1 = x0 + share * 14;
  const z = PAGE_TOP + 0.02;
  return pathOf(
    [
      at([x0, y - 3.4, z]),
      at([x1, y - 3.6, z]),
      at([x1 + 0.6, y + 3.2, z]),
      at([x0, y + 3.4, z]),
    ],
    true,
  );
}

/* The explain popover, built resting on the page under the term */

const POP: Plan = { x: -112, y: -2, w: 80, d: 32, r: 6 };
export const POP_LIFT = 16;

export const POP_ART = {
  shadow: solid(insetPlan(POP, 4), PAGE_TOP, 0.1).fill,
  card: solid(POP, PAGE_TOP, 1.4, 6, 0.4),
  logo: logoAt(POP.x + 4.4, POP.y + 4.2, PAGE_TOP + 1.4, 5.4),
  title: text(POP.x + 11, POP.y + 8.6, PAGE_TOP + 1.4),
  lines: join(
    [
      [POP.y + 15, POP.x + 66],
      [POP.y + 20, POP.x + 70],
      [POP.y + 25, POP.x + 42],
    ].map(([y, to]) => bar(y!, POP.x + 6, to!, PAGE_TOP + 1.4)),
  ),
  chip: solid(
    { x: POP.x + 46, y: POP.y + 22, w: 12, d: 6, r: 1.4 },
    PAGE_TOP + 1.4,
    0.5,
    3,
  ),
  chipText: text(POP.x + 47.6, POP.y + 26.4, PAGE_TOP + 1.9),
};

/* The lab results panel on the right */

const PANEL: Plan = { x: 46, y: -72, w: 96, d: 168, r: 8 };
const PANEL_TOP = 2.4;
const TAB: Plan = { x: 50, y: -68, w: 42, d: 10, r: 5 };
const CARD_W = 84;
const CARD_D = 30;
const CARD_X = 52;
const CARD_TOP = PANEL_TOP + 1.2;
const cardY = (index: number) => -42 + index * 34;
export const TRACK = [CARD_X + 4, CARD_X + CARD_W - 4] as const;
export const markerX = (marker: number) =>
  TRACK[0] + marker * (TRACK[1] - TRACK[0]);

function card(index: number) {
  const y = cardY(index);
  const plan: Plan = { x: CARD_X, y, w: CARD_W, d: CARD_D, r: 5 };
  const pill: Plan = {
    x: CARD_X + CARD_W - 19,
    y: y + 3.6,
    w: 15,
    d: 7,
    r: 3.5,
  };
  return {
    card: solid(plan, PANEL_TOP, CARD_TOP - PANEL_TOP, 6, 0.4),
    name: text(CARD_X + 4, y + 9, CARD_TOP),
    detail: bar(y + 13, CARD_X + 4, CARD_X + 40, CARD_TOP),
    value: text(CARD_X + 4, y + 20.5, CARD_TOP),
    pill: solid(pill, CARD_TOP, 0.5, 4),
    pillText: text(pill.x + 2.6, pill.y + 5, CARD_TOP + 0.5),
    track: bar(y + 25, TRACK[0], TRACK[1], CARD_TOP),
    band: solid(
      {
        x: markerX(BAND[0]),
        y: y + 24.2,
        w: markerX(BAND[1]) - markerX(BAND[0]),
        d: 1.6,
        r: 0.8,
      },
      CARD_TOP,
      0.3,
      3,
    ),
  };
}

const DOT_Y = (index: number) => cardY(index) + 25;

export const PANEL_ART = {
  panel: solid(PANEL, 0, PANEL_TOP, 6, 0.4),
  tab: solid(TAB, PANEL_TOP, 0.6, 5),
  tabText: text(TAB.x + 5, TAB.y + 6.4, PANEL_TOP + 0.6),
  askText: text(TAB.x + 50, TAB.y + 6.4, PANEL_TOP),
  divider: bar(-55, PANEL.x + 2, PANEL.x + PANEL.w - 2, PANEL_TOP),
  summary: text(CARD_X, -47.5, PANEL_TOP),
  cards: CARDS.map((_, index) => card(index)),
};

/** A gauge dot, built at the start of its track and slid along x. */
export const dotAt = (index: number, flagged: boolean) =>
  cylinder(
    TRACK[0],
    DOT_Y(index),
    flagged ? 2 : 1.8,
    CARD_TOP + 0.3,
    0.9,
    P,
    16,
  );

/* The chat answer, built resting in its slot at the foot of the panel */

const CHAT: Plan = { x: CARD_X, y: 64, w: CARD_W, d: 28, r: 6 };
export const CHAT_LIFT = 7;
const CHAT_TOP = PANEL_TOP + 1.2;
const ANSWER = [
  [CHAT.y + 15, CHAT.x + 4, CHAT.x + 78],
  [CHAT.y + 20, CHAT.x + 4, CHAT.x + 70],
  [CHAT.y + 25, CHAT.x + 4, CHAT.x + 44],
] as const;

export const CHAT_ART = {
  card: solid(CHAT, PANEL_TOP, CHAT_TOP - PANEL_TOP, 6, 0.4),
  question: text(CHAT.x + 4, CHAT.y + 8.4, CHAT_TOP),
  chip: solid(
    { x: CHAT.x + 47, y: CHAT.y + 22, w: 12, d: 6, r: 1.4 },
    CHAT_TOP,
    0.5,
    3,
  ),
  chipText: text(CHAT.x + 48.6, CHAT.y + 26.4, CHAT_TOP + 0.5),
};

/** The answer's lines, typed out to `share` of their length. */
export function answerPath(share: number) {
  const total = ANSWER.reduce((sum, [, from, to]) => sum + (to - from), 0);
  let left = share * total;
  const paths: string[] = [];
  for (const [y, from, to] of ANSWER) {
    if (left <= 0) break;
    const length = Math.min(to - from, left);
    paths.push(bar(y, from, from + length, CHAT_TOP));
    left -= length;
  }
  return join(paths);
}
