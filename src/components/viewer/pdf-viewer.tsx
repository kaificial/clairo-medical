"use client";

import dynamic from "next/dynamic";

import type { PdfViewerProps } from "./pdf-viewer-view";

const PdfViewerView = dynamic(
  () => import("./pdf-viewer-view").then((m) => m.PdfViewerView),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 flex min-h-[60vh] flex-1 items-center justify-center rounded-xl border">
        <p className="text-muted-foreground text-sm">Loading viewer...</p>
      </div>
    ),
  },
);

export function PdfViewer(props: PdfViewerProps) {
  return <PdfViewerView key={props.file} {...props} />;
}
