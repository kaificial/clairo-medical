import { DocumentWorkspace } from "@/components/viewer/document-workspace";
import { chatEnabled, embeddingsEnabled } from "@/lib/ai/server";

export default async function ViewerPage({
  searchParams,
}: PageProps<"/viewer">) {
  const { example } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Your report</h1>
        <p className="text-muted-foreground text-sm">
          Open a lab, imaging, or discharge PDF. See which results are out of
          range, highlight a term to define it, and ask questions about it.
        </p>
      </div>
      <DocumentWorkspace
        aiEnabled={chatEnabled}
        semanticEnabled={embeddingsEnabled}
        openExample={example === "1"}
        className="flex-1"
      />
    </main>
  );
}
