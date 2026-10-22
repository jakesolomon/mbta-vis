# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

MBTA ridership visualization, built as a portfolio piece: a Next.js app that charts monthly ridership recovery by mode, backed by a linked Supabase project. Raw NTD spreadsheets are turned into CSV and loaded into Supabase by Bun scripts.

## Commands

Package manager and script runner is **Bun** (`packageManager: bun@1.4.3`).

```bash
bun install
bun dev                      # next dev on http://localhost:3000
bun run build                # next build
bun run lint                 # eslint (flat config, next core-web-vitals + typescript)
bun test                     # bun:test, all *.test.ts(x); `bun test lib/` or `-t <name>` to narrow
bun run extract [file.xlsx]  # bun scripts/extract.ts: newest data/raw/*.xlsx (or given file) -> data/ridership.csv
bun run seed [file.csv]      # bun scripts/seed.ts: replace ridership_raw with data/ridership.csv (or given file)
bunx supabase db reset --linked --no-seed   # wipe the linked DB and rerun migrations (then `bun run seed`)
bunx supabase migration list --linked       # compare local vs remote migrations
```

## Tests

`bun test` (Bun's built-in runner, no extra deps). Tests sit next to what they cover:

- `lib/ridership.test.ts`: `indexTo2019Average`, and `getMonthlyRidership` paging/`since`/errors with `next/cache` and supabase-js replaced via `mock.module` (so the module is imported dynamically after the mocks).
- `scripts/extract.test.ts`, `scripts/seed.test.ts`: the scripts' pure parts (`toMonth`, `extractCsv`, `parseCsv`). The scripts only do I/O under `import.meta.main`, so importing them is side-effect free; keep it that way.
- `data/ridership.test.ts`: the committed CSV is well-formed, unique on the primary key, and has all of 2019 for every mode group.
- `app/ridership-chart.test.tsx`: server-renders the chart with `react-dom/server` (720px initial width) and checks the aria summary, legend and data table. No DOM, so pointer/keyboard interaction and the narrow layout aren't covered.

The SQL views aren't tested; they need a database.

## Next.js 16 specifics

This is Next.js 16.4 / React 19.3 — APIs differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, …) before writing Next code. Notable settings in `next.config.ts`:

- `cacheComponents: true` and `partialPrefetching: true` — caching/rendering semantics follow the Cache Components model, not the old `fetch`-cache / route segment config defaults.
- Tailwind v4 is wired through Turbopack's `@tailwindcss/turbopack` loader for `*.css` (no PostCSS config). Theme tokens live in `app/globals.css` via `@theme inline`.
- Layouts use the global `LayoutProps<"/">` / route-typed helpers generated into `.next/types`.

Import alias: `@/*` maps to the repo root.

## App

- `lib/ridership.ts`: `getMonthlyRidership(since?)` reads the `ridership_monthly` view with supabase-js (publishable key), paging in 1000-row chunks because PostgREST caps responses at `max_rows = 1000`. It's a `'use cache'` function with `cacheLife('days')`, so `/` prerenders as static. `indexTo2019Average(rows, modeGroup)` turns one mode's months into percent of that mode's 2019 monthly average (throws unless all 12 months of 2019 are present).
- `app/page.tsx` (Server Component) fetches from 2019-01-01, indexes each mode in `MODES` (Commuter rail, Bus, Subway), and passes them to `app/ridership-chart.tsx`. `MODES` order sets each mode's color slot, so keep it stable.
- `app/ridership-chart.tsx` (client) is a visx line chart (`@visx/*` v4 + `d3-array`): shared percent y-axis with a 100% baseline, legend, end labels (hidden under 480px or when they'd collide), crosshair tooltip on pointer and arrow keys, and a data table in `<details>`.
- Chart colors are CSS variables in `app/globals.css` (`--chart-series-1..3`, `--chart-grid`, `--chart-axis`, `--chart-muted`, `--chart-ink-secondary`), with dark values under `prefers-color-scheme: dark`. A 4th series (e.g. Ferry) needs a 4th slot added there and to `COLORS`.
- Dates are `YYYY-MM-DD` strings parsed as UTC; format with `timeZone: 'UTC'` and an explicit `en-US` locale to avoid hydration mismatches.

## Data pipeline

- `data/raw/` holds source spreadsheets (`*.xlsx` gitignored). File names change with each data release, so nothing should hardcode them.
- `scripts/extract.ts` reads an NTD-style workbook (sheet `UPT`), filters to MBTA's NTD ID (`10003`), detects month columns (Excel serial dates or `M/YYYY` headers), and writes long-format `mode,tos,month,trips` rows to `data/ridership.csv`.
- Input is the path passed as the first argument, or else the most recently modified `.xlsx` in `data/raw/`. The script is still a draft: its column names and agency ID are flagged in comments as needing verification against the real file.
- `data/ridership.csv` is committed. `scripts/seed.ts` deletes and reinserts all of `ridership_raw` in one transaction, connecting as the table owner (`SUPABASE_DB_URL`, or `supabase/.temp/pooler-url` + `SUPABASE_DB_PASSWORD`).

## Supabase

`supabase/config.toml` is for a project linked via the Supabase CLI (local ports: API 54321, DB 54322, Studio 54323; Postgres 17). Link state lives in `supabase/.temp/` (gitignored: a fresh worktree needs it copied over, or `bunx supabase link`). There is no `seed.sql`; seeding is `bun run seed`.

`.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_DB_PASSWORD`.

Schema is a single migration, `supabase/migrations/20261018171912_init.sql`:

- `ridership_raw (mode, tos, month, trips)`: RLS enabled with a select-only policy for `anon`/`authenticated`, so the API can't write. The seed script bypasses RLS as the owner.
- `ridership_monthly`: trips summed per `mode_group` (HR/LR → Subway, MB/RB/TB → Bus, CR → Commuter rail, FB → Ferry) and month. Demand response (`DR`, The RIDE) is excluded.
- `ridership_vs_2019`: each month vs the same calendar month of 2019 (not used by the app, which indexes to the 2019 annual average instead).
- Both views are `security_invoker = true` so they apply the table's RLS.

**Keep the migration history clean.** This is a portfolio piece: schema changes go into the existing init migration rather than a new follow-up migration, then reset the linked DB, re-migrate and re-seed (`db reset --linked --no-seed`, `bun run seed`). Resetting is fine since the database holds only reproducible data.
