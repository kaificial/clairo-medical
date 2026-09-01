import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <div className="flex flex-col gap-3">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">
          Clairo
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Understand your medical report. Upload a lab or imaging PDF and get
          plain-language explanations, highlight-to-define, and a
          document-grounded chat.
        </p>
        <p className="text-muted-foreground text-sm">
          Disclaimer! Clairo helps you understand your document. It's not a medical device
          and doesn't replace your doctor.
        </p>
      </div>
      <div>
        <Button disabled>Start analysis — coming s00n</Button>
      </div>
    </main>
  );
}
