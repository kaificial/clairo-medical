import {
  CARD_ART,
  CHAT,
  CHAT_CHIP,
  DOTS,
  PANE,
  PANEL,
  POP_SHADOW,
  POPOVER,
  PRINT,
  WINDOW,
} from "./art";
import { SceneLive } from "./live";

const LABEL =
  "The Clairo viewer, drawn in isometric. On the left a page of the example report is open, and the term ALT gets highlighted. A small card lifts off the page with a plain explanation that cites page 2. On the right, the ALT result card rises and its gauge dot slides out past the green typical range, marked High. Then a chat answer types in under the question what is out of range, with a page 2 citation.";

export function AppScene({ className }: { className?: string }) {
  return (
    <SceneLive
      label={LABEL}
      className={className}
      shell={WINDOW}
      pane={PANE}
      print={PRINT}
      shadow={POP_SHADOW}
      panel={PANEL}
      cards={CARD_ART}
      dots={DOTS}
      chat={CHAT}
      chip={CHAT_CHIP}
      popover={POPOVER}
    />
  );
}
