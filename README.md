# MBTA ridership recovery by mode

MBTA ridership recovery by mode, from FTA National Transit Database monthly data.

Live URL: `TODO(Jake): deployed URL`

Status: early. The extract step works and its output is in `data/ridership.csv`. The database, views and chart page are not built yet; see [Next steps](#next-steps). Sections below say which parts exist and which are planned.

## Question

Has MBTA ridership recovered since 2019, and how does recovery differ by mode?

Working hypothesis (not yet tested): commuting hasn't returned. Where ridership did recover, it came from off-peak and leisure trips. If that's right, summer months should be closer to their 2019 levels than winter months, and the gap should be largest on commuter rail.

Finding: `TODO(Jake): headline result once the chart is built`

## Data

- Source: FTA National Transit Database monthly ridership workbook, `UPT` (unlinked passenger trips) tab.
- Release: `TODO(Jake): release name and date`
- The raw workbook goes in `data/raw/` and is gitignored (`/data/raw/*.xlsx`). `data/ridership.csv` is the cleaned output and is meant to be committed.
- The current CSV covers January 2002 through August 2026.
- NTD revises recent months after release, so the last few months of any release are provisional.

## Pipeline

```
NTD workbook (.xlsx) --extract--> data/ridership.csv --seed--> ridership_raw --views--> app
```

| Step | What it does | Status |
|---|---|---|
| Extract (`scripts/extract.ts`) | Reads the `UPT` sheet, keeps rows with NTD ID `10003` (MBTA), turns each month column into its own row, converts month headers (Excel serial dates or `M/YYYY`) to `YYYY-MM-01`, strips thousands separators, skips blank cells. Writes `mode,tos,month,trips`. | Built |
| Extract: duplicate check | Fail if any `mode`/`tos`/`month` appears twice. | Not built. The current CSV has no duplicates (checked by hand), but the script doesn't enforce it. |
| Seed | Upsert the CSV into `ridership_raw` with no transformation. | Not built |
| Views | Mode grouping and the 2019 baseline math. | Not built |

The reason for this split: `ridership_raw` should stay a faithful copy of NTD, and grouping or baseline decisions should change through a migration, not by re-running the extract.

The script takes a workbook path as its first argument. Without one, it uses the most recently modified `.xlsx` in `data/raw/`, because the file name changes with every NTD release. The NTD ID and column names are still marked in the code as needing verification against the source file.

## Method and groupings

These are my choices for the analysis. The views that will implement them don't exist yet.

| NTD mode | Description | Group |
|---|---|---|
| HR | Heavy rail | Subway |
| LR | Light rail | Subway |
| MB | Bus | Bus |
| RB | Bus rapid transit | Bus |
| TB | Trolleybus | Bus |
| CR | Commuter rail | Commuter rail |
| DR | Demand response (paratransit) | Excluded |
| FB | Ferry | Excluded for now (see Next steps) |

- Directly operated (DO) and purchased transportation (PT) trips are added together within each mode. This matters for commuter rail: in the CSV it is reported as DO through December 2008 and as PT from January 2009.
- Baseline: I compare each month to the same calendar month in 2019, so seasonal patterns don't show up as recovery or decline.

Caveats:

- Trolleybus: TB rows end in June 2022, when the trolleybuses were retired. Grouping TB with bus means that change is absorbed in the Bus total.
- Green Line Extension (opened 2022) adds light-rail riders with no 2019 equivalent, which pushes Subway recovery up.
- Commuter rail schedules changed in 2020–21, so service levels aren't the same as in 2019.
- NTD monthly data has no weekday/weekend split, so the leisure hypothesis can only be tested indirectly, through seasonal patterns.

## Schema and migrations

Not built yet. `supabase/config.toml` exists for a project linked with the Supabase CLI, but there is no `supabase/migrations/` directory and no `seed.sql`.

Planned approach:

- Migrations live in `supabase/migrations/` and are applied to the hosted project with `supabase db push`.
- I never edit a migration that has already been applied. Changes go in a new migration.
- Seed data is loaded by a script, not by a migration.

The tables, views, RLS policies, and whether the views use `security_invoker` will be documented here from the SQL once it exists.

## App Router architecture

Not built yet. `app/page.tsx` is still the create-next-app template. What is already set up in `next.config.ts`:

- `cacheComponents: true`: caching uses the Cache Components model (`'use cache'` and `cacheLife`), not the older `fetch` cache.
- `partialPrefetching: true`.
- Tailwind v4 through the `@tailwindcss/turbopack` loader.

The planned design is in Next steps.

## Verification

There is no automated verification yet. No test framework is installed, so `bun test` has nothing to run, and there's no SQL sanity check or deployed page. What I checked by hand in the current CSV:

- No duplicate `mode`/`tos`/`month` rows.
- First and last month for each mode/TOS pair, which is how I found the commuter rail DO-to-PT switch and the trolleybus end date above.

## Running locally

Requires [Bun](https://bun.sh) (`bun@1.4.3`).

```bash
bun install

# put an NTD monthly ridership .xlsx in data/raw/, then:
bun scripts/extract.ts            # or: bun scripts/extract.ts path/to/file.xlsx

bun dev                           # http://localhost:3000 (template page for now)
```

No app code reads environment variables yet. The Supabase database password is kept in `.env.local`, which is gitignored. Once seeding exists, the service role key it needs will be local-only and won't be used by the deployed app.

## How I built this

I used Claude to help plan the architecture and cut the scope down to a weekend's worth of work, and Claude Code to speed up development. I review all of its output and test the code it writes before keeping it.

## Next steps

Pipeline and data
- Make `extract.ts` fail on duplicate `mode`/`tos`/`month` rows.
- Confirm the NTD ID and column names against the source workbook.
- Seed script: CSV → `ridership_raw` via upsert, using the service role key locally.
- Add ferry (FB) as a fourth mode group.

Database
- First migrations: `ridership_raw`, a mode-group mapping, and views for monthly totals by group and percent of the same month in 2019. RLS on tables, `security_invoker` on views.
- SQL sanity check: every 2019 month should come out at 100%.
- Local Supabase through Docker/OrbStack instead of working only against the hosted project.
- Supabase GitHub integration so migrations deploy from the repo.

App
- Server component that reads the views through a `'use cache'` function with `cacheLife` (the data changes monthly). It will use plain supabase-js with the anon key, because cached functions can't read cookies.
- Client visx components for the charts and mode toggles.
- Seasonal dumbbell chart (summer vs. winter recovery by mode) to test the hypothesis.
- `loading.tsx`.
- Annotations table plus an admin server action to add notes such as GLX opening and the end of trolleybus service.

Testing
- Vitest component tests.
- Playwright end-to-end check of the deployed page.
