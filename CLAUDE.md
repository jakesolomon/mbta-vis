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
bunx supabase db push --linked              # apply new migrations to the linked DB
bunx supabase db reset --linked --no-seed   # rebuild the linked DB from migrations (then `bun run seed`); see Supabase below
bunx supabase migration list --linked       # compare local vs remote migrations
```

## Tests

`bun test` (Bun's built-in runner, no extra deps). Tests sit next to what they cover:

- `lib/ridership.test.ts`: `indexTo2019Average`, and `getMonthlyRidership` paging/`since`/errors with `next/cache` and supabase-js replaced via `mock.module` (so the module is imported dynamically after the mocks).
- `lib/event-layout.test.ts`: event date formatting, label lane stacking, which months an event shows under, and event hit testing.
- `lib/annotation-form.test.ts`: `parseAnnotation` trimming, nulls and each validation error.
- `lib/summary.test.ts`: `summarize` (last-12-month average, latest and lowest month) and `yearAverage`.
- `lib/events.test.ts`: `getEvents` row mapping, ordering and errors, with the same `mock.module` setup as `lib/ridership.test.ts`.
- `scripts/extract.test.ts`, `scripts/seed.test.ts`: the scripts' pure parts (`toMonth`, `extractCsv`, `parseCsv`). The scripts only do I/O under `import.meta.main`, so importing them is side-effect free; keep it that way.
- `data/ridership.test.ts`: the committed CSV is well-formed, unique on the primary key, and has all of 2019 for every mode group.
- `app/external-link.test.tsx`: the arrow, the screen-reader text, and that it doesn't open a new tab.
- `app/ridership-chart.test.tsx`: server-renders the chart with `react-dom/server` (720px initial width) and checks the aria summary, event labels and data table. No DOM, so pointer/keyboard interaction and the narrow layout aren't covered.

The SQL views aren't tested; they need a database.

## Next.js 16 specifics

This is Next.js 16.4 / React 19.3 — APIs differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, …) before writing Next code. Notable settings in `next.config.ts`:

- `cacheComponents: true` and `partialPrefetching: true` — caching/rendering semantics follow the Cache Components model, not the old `fetch`-cache / route segment config defaults.
- `headers()` sends `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff` and `Referrer-Policy` on every path, and `poweredByHeader: false`. There's deliberately no `script-src` CSP: Next's inline scripts would need per-request nonces, which would stop `/` prerendering as static.
- Tailwind v4 is wired through Turbopack's `@tailwindcss/turbopack` loader for `*.css` (no PostCSS config). Theme tokens live in `app/globals.css` via `@theme inline`.
- Layouts use the global `LayoutProps<"/">` / route-typed helpers generated into `.next/types`.

Import alias: `@/*` maps to the repo root.

## App

- `lib/supabase.ts`: `supabaseEnv()` and the anonymous server-side supabase-js client (publishable key, no session, so RLS applies as `anon`). Safe inside `'use cache'`.
- `lib/auth.ts`: `authClient()`, a per-request `@supabase/ssr` client on the auth cookies (runs as the signed-in user), and `getAdmin()` (verifies the JWT with `getClaims`; reads cookies, so callers sit behind `<Suspense>`). Sign-ups are off, so any valid session is the admin.
- `proxy.ts` refreshes the Supabase session cookie on `/admin/*` before Server Components render (they can't write cookies). It doesn't gate access.
- `app/admin/login` is a static email/password form (`useActionState`) posting to the `signIn` server action in `app/admin/actions.ts`; `signOut` is there too. `app/admin/page.tsx` is partially prerendered: the shell is static and `AdminPanel` streams in behind `<Suspense>`, redirecting to `/admin/login` without a session, then reads the annotations fresh as the signed-in user (not via the cached `getEvents`). Both pages are `noindex`.
- `app/admin/annotations-table.tsx` (client) is the annotations table: inline edit per row, delete with a `confirm()`, and an add row in `<tfoot>`. Inputs sit in table cells and join their row's form via the `form` attribute. They're controlled, and the forms submit through `onSubmit` + `startTransition` rather than `action`, because React's post-action form reset blanks a controlled `<select>`. The `saveAnnotation` (insert without an id, update with one) and `deleteAnnotation` server actions in `app/admin/actions.ts` validate with `parseAnnotation`, write through `authClient()` so RLS applies, then `updateTag('annotations')` (the chart sees the change on the next request) and `refresh()` (the table re-renders).
- `lib/annotation-form.ts`: the admin's `Annotation` row type and `parseAnnotation(formData)`, which mirrors the table constraints, plus two app-only limits: `LABEL_MAX` (40) and modes limited to `MODES` (the table's check also allows Ferry).
- `lib/ridership.ts`: `getMonthlyRidership(since?)` reads the `ridership_monthly` view with supabase-js (publishable key), paging in 1000-row chunks because PostgREST caps responses at `max_rows = 1000`. It's a `'use cache'` function with `cacheLife('days')`, so `/` prerenders as static. `indexTo2019Average(rows, modeGroup)` turns one mode's months into percent of that mode's 2019 monthly average (throws unless all 12 months of 2019 are present).
- `app/layout.tsx` wraps every page (admin included) in `app/site-header.tsx` (black sign band: wordmark, a site nav with How it's built and Admin, then GitHub after a divider) and `app/site-footer.tsx` (data source, stack, repo, author). Any link that leaves the site uses `app/external-link.tsx` (`ExternalLink`): it adds a ↗ arrow and screen-reader text and opens in the same tab. Keep off-site links out of the site `<nav>`. Both are static, so the header always shows the Admin link; don't add a session check there or `/` stops prerendering. Repo links come from `lib/site.ts` (`REPO_URL`, `repoFile(path)`).
- `app/page.tsx` (Server Component) fetches ridership from 2019-01-01 and the annotations in parallel, indexes each mode in `MODES` (`lib/modes.ts`: Commuter rail, Bus, Subway), and passes them to `app/ridership-chart.tsx`. It also renders the headline, one stat board per mode, interpretive paragraphs and the "How it's built" route map (`#how`). The numbers in the copy come from `lib/summary.ts` (`summarize`, `yearAverage`), but the headline and the reasoning are hand-written for the data as of Aug 2026, so reread them after a new data release. `MODES` order sets each mode's color slot, so keep it stable. It's also the admin's mode dropdown and what `parseAnnotation` accepts, so Ferry stays out of both until it's charted.
- `app/ridership-chart.tsx` (client) is a visx line chart (`@visx/*` v4 + `d3-array`): shared percent y-axis with a 100% baseline, legend, end labels (hidden under 480px or when they'd collide), event annotations, crosshair tooltip on pointer and arrow keys, and a data table in `<details>`.
- `lib/event-layout.ts` has the chart's pure event helpers: `monthOf`, `fmtEventDates`, `stackLabels` (lane assignment), `eventMonths` (the months an event shows under in the tooltip: its calendar months plus the nearest month point, so a late-March event also shows under April; the data table uses calendar months only) and `hitEvent` (pointer on an event's label, near its rule or inside its span; the crosshair then snaps to one of that event's months). Events in the tooltip are highlighted on the chart.
- `lib/events.ts`: `getEvents()` reads the `annotations` table into the chart's `RidershipEvent` shape: a point (`start`) or span (`start`–`end`) with a short on-chart `label` and an optional tooltip/table `detail`, keyed by `id`. Cached with `cacheLife('days')` and `cacheTag('annotations')`, so whatever adds or deletes an annotation must `revalidateTag('annotations')`. Labels stack in lanes above the plot (the top margin grows per lane); under 480px they become numbers keyed to a list below the chart.
- Design: transit wayfinding. Public Sans (`font-sans`) and IBM Plex Mono (`font-mono`) via `next/font`. Site tokens in `app/globals.css` (`--background`, `--foreground`, `--muted`, `--rule`, `--panel`, `--band`, `--band-ink`, `--danger`) are exposed to Tailwind through `@theme inline` (`bg-band`, `text-muted`, `text-band-muted`, …), as are the chart tokens (`text-chart-muted`, `bg-chart-series-1`, …). Type steps Tailwind lacks are theme tokens too: `text-micro` (11px), `text-caption` (13px), `text-wordmark`, `text-stat`, `leading-display`, `tracking-display`, `tracking-wordmark`, `tracking-eyebrow`, plus an `eyebrow` utility for small uppercase labels. Components use only these: no raw colors, `rgba()`, palette classes (`zinc-600`, `black/10`) or arbitrary `text-[…]`/`tracking-[…]` values; if something's missing, add a token (light and dark values for colors) to `app/globals.css`. Arbitrary values are left only for one-off layout (`max-w-[60ch]`, `grid-cols-[auto_1fr]`). SVG attributes take `var(--…)` strings, since classes don't reach them. Square corners and 2px ink borders, no shadows.
- Chart colors are CSS variables in `app/globals.css` (`--chart-series-1..3` are the MBTA purple, bus yellow and red line colors, with `--chart-series-N-ink` for text on a filled swatch; plus `--chart-grid`, `--chart-axis`, `--chart-muted`, `--chart-ink-secondary`), with dark values under `prefers-color-scheme: dark`. Events are drawn as stops (circle + bold label). A 4th series (e.g. Ferry) needs a 4th slot (and its `-ink`) added there, to `COLORS` and to `BULLETS` in `app/page.tsx`, and the mode added to `MODES`.
- Dates are `YYYY-MM-DD` strings parsed as UTC; format with `timeZone: 'UTC'` and an explicit `en-US` locale to avoid hydration mismatches.

## Data pipeline

- `data/raw/` holds source spreadsheets (`*.xlsx` gitignored). File names change with each data release, so nothing should hardcode them.
- `scripts/extract.ts` reads an NTD-style workbook (sheet `UPT`), filters to MBTA's NTD ID (`10003`), detects month columns (Excel serial dates or `M/YYYY` headers), and writes long-format `mode,tos,month,trips` rows to `data/ridership.csv`.
- Input is the path passed as the first argument, or else the most recently modified `.xlsx` in `data/raw/`. It throws if the `NTD ID`, `Mode` or `TOS` header is missing.
- `data/ridership.csv` is committed. `scripts/seed.ts` deletes and reinserts all of `ridership_raw` in one transaction, connecting as the table owner (`SUPABASE_DB_URL`, or `supabase/.temp/pooler-url` + `SUPABASE_DB_PASSWORD`).

## Supabase

`supabase/config.toml` is for a project linked via the Supabase CLI (local ports: API 54321, DB 54322, Studio 54323; Postgres 17). Link state lives in `supabase/.temp/` (gitignored: a fresh worktree needs it copied over, or `bunx supabase link`). There is no `seed.sql`; seeding is `bun run seed`.

`.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_DB_PASSWORD`.

Migrations:

`supabase/migrations/20261018171912_init.sql`:

- `ridership_raw (mode, tos, month, trips)`: RLS enabled with a select-only policy for `anon`/`authenticated`, so the API can't write. The seed script bypasses RLS as the owner.
- `ridership_monthly`: trips summed per `mode_group` (HR/LR → Subway, MB/RB/TB → Bus, CR → Commuter rail, FB → Ferry) and month. Demand response (`DR`, The RIDE) is excluded.
- `ridership_vs_2019`: each month vs the same calendar month of 2019 (not used by the app, which indexes to the 2019 annual average instead).
- Both views are `security_invoker = true` so they apply the table's RLS.

`supabase/migrations/20261022113612_annotations.sql`:

- `annotations (id, date, label, mode_group, created_at)`: chart event annotations added by the admin through the site. `mode_group` is null for all-mode events, otherwise one of the `ridership_monthly` groups (not drawn by the chart yet). RLS: public select; insert, update and delete only for the admin's user id (`20261023140621_annotations_admin_only_writes.sql` replaced the earlier any-`authenticated` policies).
`supabase/migrations/20261022114251_annotation_spans_and_details.sql` adds `end_date` (after `date`; makes it a span) and `detail` to `annotations`. `supabase/migrations/20261022114252_seed_annotations.sql` inserts the five starting annotations. Schema and data changes go in separate migrations.

- Sign-ups are disabled (`enable_signup = false` in `config.toml` and on the linked project), so the only authenticated user is the admin account created in the Supabase dashboard. The annotation write policies also check that account's id (`32aef977-…`), so another account couldn't write even if sign-ups were turned on; `getAdmin()` doesn't check the id, so it would still let that account see the admin page.

**Migrations are append-only.** The linked project has already applied them, so add changes as a new migration (`bunx supabase migration new <name>`) and apply it with `bunx supabase db push --linked` rather than editing old ones.

**Resetting.** `db reset --linked --no-seed` + `bun run seed` rebuilds everything that's in the repo, including the annotations inserted by seed migrations. Annotations added through `/admin` since the last annotations seed migration are lost unless you first add them to a new seed migration. Check whether the admin user in `auth.users` survives a reset before relying on it; if not, re-add it in the dashboard, and since the new account gets a new id, add a migration pointing the annotation write policies at it.

**Auth settings.** Change them in the dashboard, not with `supabase config push`: it pushes the whole `config.toml`, whose local-dev values (site URL, MFA) differ from the linked project.
