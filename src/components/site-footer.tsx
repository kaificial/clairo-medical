import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-border/60 mt-24 border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo className="size-5" />
          <span className="text-sm font-medium tracking-tight lowercase">
            Clairo
          </span>
        </div>

        <p className="text-muted-foreground max-w-sm text-sm">
          Disclaimer! Clairo helps you understand your document. It's not a
          medical device and doesn't replace your doctor :D
        </p>

        <nav className="text-muted-foreground flex gap-6 text-sm">
          <Link href="/#how" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/#privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </nav>
      </div>
      <div className="text-muted-foreground mx-auto max-w-5xl px-6 pb-8 text-xs">
        © {new Date().getFullYear()} Clairo
      </div>
    </footer>
  );
}
