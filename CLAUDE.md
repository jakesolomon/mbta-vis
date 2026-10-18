# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

MBTA ridership visualization: a Next.js app (early stage, `app/page.tsx` is still the create-next-app template) backed by a linked Supabase project, with raw ridership spreadsheets turned into CSV by a Bun script.

## Commands

Package manager and script runner is **Bun** (`packageManager: bun@1.4.3`).

```bash
bun install
bun dev                      # next dev on http://localhost:3000
bun run build                # next build
bun run lint                 # eslint (flat config, next core-web-vitals + typescript)
bun run extract [file.xlsx]  # bun scripts/extract.ts: newest data/raw/*.xlsx (or given file) -> data/ridership.csv
```

No test framework is set up.

## Next.js 16 specifics

This is Next.js 16.4 / React 19.3 — APIs differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, …) before writing Next code. Notable settings in `next.config.ts`:

- `cacheComponents: true` and `partialPrefetching: true` — caching/rendering semantics follow the Cache Components model, not the old `fetch`-cache / route segment config defaults.
- Tailwind v4 is wired through Turbopack's `@tailwindcss/turbopack` loader for `*.css` (no PostCSS config). Theme tokens live in `app/globals.css` via `@theme inline`.
- Layouts use the global `LayoutProps<"/">` / route-typed helpers generated into `.next/types`.

Import alias: `@/*` maps to the repo root.

## Data pipeline

- `data/raw/` holds source spreadsheets (`*.xlsx` gitignored). File names change with each data release, so nothing should hardcode them.
- `scripts/extract.ts` reads an NTD-style workbook (sheet `UPT`), filters to MBTA's NTD ID (`10003`), detects month columns (Excel serial dates or `M/YYYY` headers), and writes long-format `mode,tos,month,trips` rows to `data/ridership.csv`.
- Input is the path passed as the first argument, or else the most recently modified `.xlsx` in `data/raw/`. The script is still a draft: its column names and agency ID are flagged in comments as needing verification against the real file.

## Supabase

`supabase/config.toml` is for a project linked via the Supabase CLI (local ports: API 54321, DB 54322, Studio 54323; Postgres 17). Migrations and `seed.sql` are enabled in config but none exist yet. The DB password is in `.env.local` (`.env*` is gitignored).
