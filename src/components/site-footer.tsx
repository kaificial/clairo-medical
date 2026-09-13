import Link from "next/link";

import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/components/site-header";

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
          Clairo helps you understand your document. It is not a medical device,
          does not give a diagnosis, and does not replace your doctor.
        </p>

        <nav className="text-muted-foreground flex gap-6 text-sm">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="text-muted-foreground mx-auto max-w-5xl px-6 pb-8 text-xs">
        © {new Date().getFullYear()} Clairo
      </div>
    </footer>
  );
}
