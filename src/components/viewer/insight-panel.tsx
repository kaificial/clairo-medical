"use client";

import { FlaskConical, MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useState } from "react";

import { readLabTables } from "@/lib/labs";
import type { Chunk, ExtractedDocument } from "@/lib/pdf";
import type { Search } from "@/lib/retrieval";
import { cn } from "@/lib/utils";

import { ChatPanel } from "./chat-panel";
import { LabResults } from "./lab-results";

const TABS = [
  { value: "results", label: "Lab results", Icon: FlaskConical },
  { value: "ask", label: "Ask", Icon: MessageCircle },
] as const;

type Tab = (typeof TABS)[number]["value"];

/**
 * The side panel: lab results in one tab, questions about the report in the
 * other. Both stay mounted and are only hidden, so flipping to lab results and
 * back doesn't wipe the conversation.
 */
export function InsightPanel({
  extracted,
  chunks,
  search,
  aiEnabled,
  onJump,
  className,
}: {
  extracted: ExtractedDocument | null;
  chunks: readonly Chunk[] | null;
  search: Search | null;
  aiEnabled: boolean;
  onJump: (page: number) => void;
  className?: string;
}) {
  const id = useId();
  const tabId = (tab: Tab) => `${id}-${tab}-tab`;
  const panelId = (tab: Tab) => `${id}-${tab}`;

  const tableRows = useMemo(
    () => (extracted ? readLabTables(extracted) : null),
    [extracted],
  );
  const [chosen, setChosen] = useState<Tab | null>(null);

  const noLabs = tableRows !== null && tableRows.length === 0;
  const tab: Tab = chosen ?? (aiEnabled && noLabs ? "ask" : "results");

  const tabs = TABS.filter((entry) => aiEnabled || entry.value !== "ask");
  const reduce = useReducedMotion();

  return (
    <aside
      className={cn("bg-card flex flex-col rounded-xl border", className)}
      aria-label="About this report"
    >
      <div
        role="tablist"
        aria-label="Report tools"
        className="flex gap-1 border-b p-1.5"
      >
        {tabs.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={tabId(value)}
            aria-selected={tab === value}
            aria-controls={panelId(value)}
            onClick={() => setChosen(value)}
            className={cn(
              "group/tab rounded-pill focus-visible:ring-ring/50 relative isolate flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 active:scale-[0.97] motion-reduce:active:scale-100",
              tab === value
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* One pill slides between the tabs instead of each tab
                switching its own background on and off. */}
            {tab === value ? (
              <motion.span
                layoutId={`${id}-tab-pill`}
                aria-hidden
                className="bg-secondary rounded-pill absolute inset-0 -z-10"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 480, damping: 36 }
                }
              />
            ) : null}
            <Icon className="size-3.5 transition-transform duration-300 group-hover/tab:-rotate-12" />
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={panelId("results")}
        aria-labelledby={tabId("results")}
        hidden={tab !== "results"}
      >
        <LabResults
          tableRows={tableRows}
          chunks={chunks}
          aiEnabled={aiEnabled}
          onJump={onJump}
        />
      </div>

      {aiEnabled ? (
        <div
          role="tabpanel"
          id={panelId("ask")}
          aria-labelledby={tabId("ask")}
          hidden={tab !== "ask"}
        >
          <ChatPanel search={search} onJump={onJump} />
        </div>
      ) : null}
    </aside>
  );
}
