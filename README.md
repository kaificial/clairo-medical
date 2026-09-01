# Clairo

Understand your medical report. Clairo turns a lab or imaging **PDF** into
plain language: a clean PDF reader, highlight‑a‑term → instant plain‑language
definition, and a document‑grounded chat panel ("what's out of the normal
range?", "what should I ask my doctor?", "am I going to die?").

Cloud AI by default; an optional fully in‑browser local model for people who
want anything to leave their machine. Optional, opt‑in, per‑document account
sync.

> Clairo helps you **understand your document**. It's not a medical device and
> does not replace your doctor. Disclaimer!!

## Stack so far

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict, no `any`)
- **Tailwind CSS v4** · **shadcn/ui** (`new-york`, neutral base)
- **pnpm** · **Node 24**
- Prettier + ESLint (flat config)

## Getting started

```bash
pnpm install                 # also installs the Husky pre-commit hook
cp .env.example .env.local   # optional; nothing is required yet
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script              | What it does                           |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Start the dev server (Turbopack)       |
| `pnpm build`        | Production build (validates env first) |
| `pnpm start`        | Serve the production build             |
| `pnpm lint`         | ESLint                                 |
| `pnpm typecheck`    | `next typegen` + `tsc --noEmit`        |
| `pnpm test`         | Vitest (unit)                          |
| `pnpm format`       | Prettier write                         |
| `pnpm format:check` | Prettier check (CI)                    |

## Environment

Environment variables are validated by [`src/env.ts`](src/env.ts) (Zod, t3-env
style). A bad or missing var fails `pnpm build` with a readable message. See
[`.env.example`](.env.example); set `SKIP_ENV_VALIDATION=1` to bypass.

## Quality gates

- **Pre-commit** (Husky + lint-staged): Prettier and ESLint on staged files.
- **CI** (GitHub Actions, `.github/workflows/ci.yml`): `format:check → lint →
typecheck → test → build` on every push to `main` and every PR.

## Project layout

```
src/
  app/                 App Router routes, layout, global styles
  env.ts               Typed, validated environment
  components/
    ui/                shadcn/ui primitives
    viewer/            PDF reader + chat + define popover        (M3/M5/M6)
  lib/
    utils.ts           Shared helpers (cn, …)
    pdf/               Layout-aware extraction + chunking        (M3)
    retrieval/         RetrievalService + hybrid strategies      (M4/M5)
    ai/                Model access via AI SDK + Gateway         (M5/M7)
    vector/            VectorStore: IndexedDB + pgvector         (M4/M8)
    auth/              Clerk, gated on `authEnabled`             (M8)
    db/                Neon Postgres client + schema             (M8)
  styles/
    tokens.css         Design tokens, single source of truth    (M1)
```

The `lib/*` and `components/viewer` folders are placeholder modules for now;
each is filled in the milestone shown.
