import { DocumentWorkspace } from "@/components/viewer";

export default function ViewerPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Your report</h1>
        <p className="text-muted-foreground text-sm">
          Open a lab, imaging, or discharge PDF, etc. Highlight to define and
          ask questions for more clairification.
        </p>
      </div>
      <DocumentWorkspace className="flex-1" />
    </main>
  );
}
