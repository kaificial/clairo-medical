import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { GithubIcon } from "@/components/icons/github";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
] as const;

// point at the real repo once it's public
const GITHUB_URL = "https://github.com/kaikimto/clairo2";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="rounded-pill border-border/70 bg-card/75 mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 border py-2 pr-3 pl-5 backdrop-blur-md">
        <Link
          href="/"
          className="rounded-pill focus-visible:ring-ring/50 flex items-center gap-2 outline-none focus-visible:ring-[3px]"
        >
          <Logo className="size-6" />
          <span className="text-[0.95rem] font-medium tracking-tight lowercase">
            Clairo
          </span>
        </Link>

        <nav className="text-muted-foreground hidden items-center gap-7 text-sm sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm transition-colors outline-none focus-visible:ring-[3px]"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm transition-colors outline-none focus-visible:ring-[3px]"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="rounded-pill sm:hidden"
            aria-label="Clairo on GitHub"
          >
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GithubIcon className="size-4" />
            </a>
          </Button>
          <ThemeToggle />
          <Button asChild className="rounded-pill">
            <Link href="/viewer">Start analysis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
