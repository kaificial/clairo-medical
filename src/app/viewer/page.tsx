import { PdfViewer } from "@/components/viewer/pdf-viewer";

export default function ViewerPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Sample report</h1>
        <p className="text-muted-foreground text-sm">
          A sample discharge summary. Highlight to define and the chat panel
          arrive next.
        </p>
      </div>
      <PdfViewer file="/example-medical.pdf" className="min-h-[70vh] flex-1" />
    </main>
  );
}
