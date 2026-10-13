import { Dots, FaceText, Line, Solid } from "@/components/iso/draw";

import { CARDS, FLAGGED } from "./model";
import {
  CHAT_ART,
  PANE_ART,
  PANEL_ART,
  POP_ART,
  WINDOW_ART,
  at,
  dotAt,
} from "./geometry";

/*
 * The parts that never change shape, built once on the server and handed to
 * the live component in painter's order. Each root carries a key so React can
 * stream them without warnings.
 */

/** Font size, in world units, of the small labels printed on the panels. */
const LABEL_SIZE = 3.4;

/**
 * The Clairo mark, the same shapes as the site's logo SVG, printed flat on a
 * face of the drawing.
 */
function FaceLogo({ transform, id }: { transform: string; id: string }) {
  return (
    <g transform={transform} className="sc-logo">
      <mask
        id={id}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="white" />
        <rect x="8.4" y="8.4" width="7.2" height="7.2" rx="2.4" fill="black" />
      </mask>
      <g mask={`url(#${id})`}>
        <circle cx="12" cy="7.3" r="5.4" />
        <circle cx="16.7" cy="12" r="5.4" />
        <circle cx="12" cy="16.7" r="5.4" />
        <circle cx="7.3" cy="12" r="5.4" />
      </g>
    </g>
  );
}

export const WINDOW = (
  <g key="window">
    <path className="iso-halo" d={WINDOW_ART.halo} />
    {WINDOW_ART.feet.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" />
    ))}
    <Solid paths={WINDOW_ART.window} tone="mid" />
    <Dots
      points={[
        at([-142, -100, 0]),
        at([142, -100, 0]),
        at([-142, 100, 0]),
        at([142, 100, 0]),
      ]}
      size={0.6}
    />
    <Solid paths={WINDOW_ART.header} tone="lo" className="sc-raised" />
    <FaceLogo transform={WINDOW_ART.logo} id="sc-header-logo" />
    <FaceText transform={WINDOW_ART.brand} size={4.4} tone="hi">
      clairo
    </FaceText>
    <Line d={WINDOW_ART.nav} tone="lo" className="sc-text" />
    <Solid paths={WINDOW_ART.toggle} tone="lo" />
    <Solid paths={WINDOW_ART.start} tone="mid" className="sc-yellow" />
    <FaceText transform={WINDOW_ART.startText} size={LABEL_SIZE} tone="hi">
      Start analysis
    </FaceText>
  </g>
);

export const PANE = (
  <g key="pane">
    <Solid paths={PANE_ART.pane} tone="lo" className="sc-sunken" />
    <Solid
      paths={PANE_ART.toolbar}
      tone="lo"
      crease="none"
      className="sc-raised"
    />
    <Line d={PANE_ART.chevrons} tone="mid" />
    <FaceText transform={PANE_ART.pageCount} size={LABEL_SIZE} tone="mid">
      2 / 3
    </FaceText>
    <Line d={PANE_ART.zoom} tone="lo" className="sc-text" />
    <Solid paths={PANE_ART.page} tone="lo" crease="none" className="sc-paper" />
  </g>
);

/** Printed on the page, above the highlighter ink. */
export const PRINT = (
  <g key="print">
    <FaceText transform={PANE_ART.heading} size={3.2} tone="mid">
      INVESTIGATIONS
    </FaceText>
    <Line d={PANE_ART.bars} tone="faint" className="sc-text" />
    <Line d={PANE_ART.rules} tone="faint" />
    {[...PANE_ART.names, ...PANE_ART.values, ...PANE_ART.units].map(
      (cell, index) => (
        <FaceText
          key={index}
          transform={cell.at}
          size={LABEL_SIZE}
          tone={index < 3 ? "hi" : "mid"}
        >
          {cell.label}
        </FaceText>
      ),
    )}
  </g>
);

export const POPOVER = (
  <g key="popover">
    <Solid paths={POP_ART.card} tone="mid" className="sc-raised" />
    <FaceLogo transform={POP_ART.logo} id="sc-pop-logo" />
    <FaceText transform={POP_ART.title} size={3.8} tone="hi">
      ALT
    </FaceText>
    <Line d={POP_ART.lines} tone="lo" className="sc-text" />
    <Solid paths={POP_ART.chip} tone="mid" />
    <FaceText transform={POP_ART.chipText} size={2.8} tone="hi">
      p.2
    </FaceText>
  </g>
);

export const POP_SHADOW = (
  <path key="pop-shadow" className="sc-shadow" d={POP_ART.shadow} />
);

export const PANEL = (
  <g key="panel">
    <Solid paths={PANEL_ART.panel} tone="mid" className="sc-raised" />
    <Solid paths={PANEL_ART.tab} tone="lo" crease="none" className="sc-tab" />
    <FaceText transform={PANEL_ART.tabText} size={3.2} tone="hi">
      Lab results
    </FaceText>
    <FaceText transform={PANEL_ART.askText} size={3.2} tone="mid">
      Ask
    </FaceText>
    <Line d={PANEL_ART.divider} tone="faint" />
    <FaceText transform={PANEL_ART.summary} size={3.6} tone="hi">
      {`${FLAGGED} of ${CARDS.length} tests outside the range`}
    </FaceText>
  </g>
);

/** One card each, so the live component can lift the one in focus. */
export const CARD_ART = CARDS.map((entry, index) => {
  const parts = PANEL_ART.cards[index]!;
  return (
    <g key={entry.label}>
      <Solid paths={parts.card} tone="mid" className="sc-raised" />
      <FaceText transform={parts.name} size={3.8} tone="hi">
        {entry.label}
      </FaceText>
      <Line d={parts.detail} tone="faint" className="sc-text" />
      <FaceText transform={parts.value} size={LABEL_SIZE} tone="hi">
        {entry.value}
      </FaceText>
      <Solid
        paths={parts.pill}
        tone="lo"
        crease="none"
        className={entry.flagged ? "sc-high" : "sc-normal"}
      />
      <FaceText transform={parts.pillText} size={2.6} tone="hi">
        {entry.status === "In range" ? "Normal" : entry.status}
      </FaceText>
      <Line d={parts.track} tone="lo" className="sc-track" />
      <Solid paths={parts.band} tone="lo" crease="none" className="sc-band" />
    </g>
  );
});

export const CHAT = (
  <g key="chat">
    <Solid paths={CHAT_ART.card} tone="mid" className="sc-raised" />
    <FaceText transform={CHAT_ART.question} size={3.4} tone="hi">
      What is out of range?
    </FaceText>
  </g>
);

export const CHAT_CHIP = (
  <g key="chat-chip">
    <Solid paths={CHAT_ART.chip} tone="mid" className="sc-chip" />
    <FaceText transform={CHAT_ART.chipText} size={2.8} tone="hi">
      p.2
    </FaceText>
  </g>
);

/** One gauge dot per card, built at the start of its track. */
export const DOTS = CARDS.map((entry, index) => (
  <Solid
    key={entry.label}
    paths={dotAt(index, entry.flagged)}
    tone="hi"
    className={entry.flagged ? "sc-high" : "sc-normal"}
  />
));
