# MBTA ridership recovery by mode

MBTA ridership recovery by mode, from FTA National Transit Database monthly data.

Live URL: https://mbta-vis.vercel.app

Status: the pipeline, database, chart page and annotation admin are built.

## Question

Has MBTA ridership recovered since 2019, and how does recovery differ by mode?

Hypothesis, written before looking at the data: commuting hasn't come back, and what recovery there is comes from off-peak and leisure trips. That predicts two things:

1. Commuter rail, the most commute-heavy mode, is furthest from 2019.
2. Summer months are closer to their 2019 levels than winter months.

Findings, with data through August 2026:

1. **Rejected.** Over the last 12 months, commuter rail averaged 100% of its 2019 monthly ridership, bus 86% and subway 70%. Commuter rail has fully recovered, and the largest gap is on the subway, which is still climbing (58% in 2023, 71% so far in 2026).
2. **Mixed at best.** Comparing each month with the same month of 2019 (the `ridership_vs_2019` view), commuter rail's summers (June–August) beat the winter before them (December–February) every year from 2023 to 2026. Bus and subway go back and forth:

   | Summer vs. winter, % of 2019 | 2023 | 2024 | 2025 | 2026 |
   |---|---|---|---|---|
   | Commuter rail | 85 vs. 72 | 101 vs. 90 | 92 vs. 88 | 105 vs. 95 |
   | Bus | 78 vs. 75 | 85 vs. 95 | 83 vs. 83 | 93 vs. 81 |
   | Subway | 60 vs. 57 | 57 vs. 54 | 63 vs. 66 | 72 vs. 66 |

   This is an indirect test, since NTD's monthly totals don't split weekday from weekend trips, and seasons carry other differences (weather, service changes, shutdowns). The table was computed once from the August 2026 release. It's left off the site because the result is inconclusive.

## Annotation admin

The events marked on the chart are managed from `/admin`. Sign in, add an event, and it shows up on the chart on the next page load:

https://github.com/user-attachments/assets/854a87c5-98c4-49f5-9cbf-e8328a26f3b0

Sign-ups are off and RLS only lets my account write. Saving invalidates the cached annotations, so the static page picks up the change without a redeploy. Details in [App Router architecture](#app-router-architecture).

## Data

- Source: FTA National Transit Database monthly ridership workbook, `UPT` (unlinked passenger trips) tab.
- Release: August 2026 Complete Monthly Ridership (with adjustments and estimates), released October 1, 2026.
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
| Extract: duplicate check | Fail if any `mode`/`tos`/`month` appears twice. | Not in the script, but `data/ridership.test.ts` fails if the committed CSV has a duplicate. |
| Seed (`scripts/seed.ts`) | Replaces `ridership_raw` with the CSV in one transaction, with no transformation. | Built |
| Views | Mode grouping (`ridership_monthly`). The app indexes each mode to its 2019 monthly average. | Built |

The reason for this split: `ridership_raw` should stay a faithful copy of NTD, and grouping decisions should change through a migration, not by re-running the extract. The 2019 baseline ended up in the app (`indexTo2019Average` in `lib/ridership.ts`) rather than in a view, so changing it is a code change.

The script takes a workbook path as its first argument. Without one, it uses the most recently modified `.xlsx` in `data/raw/`, because the file name changes with every NTD release. If the workbook has no `NTD ID`, `Mode` or `TOS` column, the script stops with an error instead of writing a bad CSV.

## Method and groupings

These are my choices for the analysis. The grouping lives in the `ridership_monthly` view.

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
- Baseline: the chart shows each month as a percentage of that mode's average month in 2019, so 100% means back to 2019 levels and seasonal swings stay visible. The seasonal check above uses the other comparison, each month against the same calendar month of 2019 (the `ridership_vs_2019` view), which takes seasonality out. The two agree on the 12-month averages.

Caveats:

- Trolleybus: TB rows end in June 2022, when the trolleybuses were retired. Grouping TB with bus means that change is absorbed in the Bus total.
- Green Line Extension (opened 2022) adds light-rail riders with no 2019 equivalent, which pushes Subway recovery up. Without it, the subway gap would be larger.
- Commuter rail schedules changed in 2020–21, so service levels aren't the same as in 2019.
- NTD monthly data has no weekday/weekend split, so the leisure part of the hypothesis can only be tested indirectly, through seasonal patterns.

## Schema and migrations

Migrations live in `supabase/migrations/` and are applied to the hosted project with `bunx supabase db push --linked`. I never edit a migration that has already been applied; changes go in a new one, and schema and data changes go in separate migrations.

- `ridership_raw (mode, tos, month, trips)`: a faithful copy of the CSV. RLS is on, with a select-only policy for `anon` and `authenticated`, so the API can't write to it. The seed script writes as the table owner.
- `ridership_monthly`: trips summed per mode group and month, using the groupings above.
- `ridership_vs_2019`: each month against the same calendar month of 2019. Not used by the app.
- `annotations (id, date, end_date, label, mode_group, detail)`: the events marked on the chart. Anyone can read them; only my admin account can insert, update or delete, enforced by RLS policies that check its user id.
- Both views use `security_invoker = true`, so they apply `ridership_raw`'s RLS instead of the view owner's privileges.

Ridership is loaded by `scripts/seed.ts`, not by a migration. The first five annotations come from a seed migration; later ones are added through the site.

## App Router architecture

Next.js 16 with Cache Components (`cacheComponents: true`), so caching uses `'use cache'` and `cacheLife` instead of the older `fetch` cache.

- `app/page.tsx` is a server component. It reads `ridership_monthly` and the annotations through `'use cache'` functions (`lib/ridership.ts`, `lib/events.ts`) with plain supabase-js and the publishable key, cached for days because the data changes monthly. The page prerenders as static HTML.
- `app/ridership-chart.tsx` is the client component: a visx line chart with event annotations, a keyboard- and pointer-driven tooltip, and a data table.
- `/admin` signs in with Supabase Auth (email and password, sign-ups off). Its shell is static and the annotations table streams in behind `<Suspense>`. Server actions write through the signed-in user's session, so RLS still applies, then invalidate the `annotations` cache tag so the chart picks up the change.

## Verification

`bun test` runs the unit tests (Bun's built-in runner):

- The extract and seed scripts' parsing.
- The committed CSV: well formed, no duplicate `mode`/`tos`/`month`, and all of 2019 for every mode group.
- The 2019 indexing, the headline stats, annotation form validation and the chart's event layout.
- A server render of the chart: the screen-reader summary, event labels and data table.

The SQL views aren't tested, because that needs a database. What I checked by hand in the CSV: first and last month for each mode/TOS pair, which is how I found the commuter rail DO-to-PT switch and the trolleybus end date above.

## Using this repo

Requires [Bun](https://bun.sh) (`bun@1.4.3`). The steps run in pipeline order.

### 1. Install

```bash
bun install
```

### 2. Get the raw data

1. On transit.dot.gov, open the NTD monthly data release page ([Monthly Module Adjusted Data Release](https://www.transit.dot.gov/ntd/data-product/monthly-module-adjusted-data-release)).
2. Download the latest **Complete Monthly Ridership (with adjustments and estimates)** workbook (`.xlsx`). The extract reads its `UPT` tab.
3. Put the file in `data/raw/`. Keep the file name as downloaded. It changes with each release, and the extract finds the file without it.

The workbook is gitignored. Only the CSV the extract produces is committed.

### 3. Extract to CSV

```bash
bun run extract                        # uses the newest .xlsx in data/raw/
bun run extract data/raw/<file>.xlsx   # or name a specific workbook
```

This writes `data/ridership.csv` and prints the file it read and the number of rows it wrote. Before committing a new CSV, check it against the hand checks in [Verification](#verification): no duplicate `mode`/`tos`/`month` rows, and first and last months for each mode that make sense. The script doesn't enforce these yet.

### 4. Database

The live site runs against my hosted Supabase project. To run your own copy:

1. Create a Supabase project.
2. Link and apply migrations:

```bash
   bunx supabase login
   bunx supabase link --project-ref <your-project-ref>
   bunx supabase db push --linked
```

Local Postgres via `bunx supabase start` (requires Docker) should also work but is untested.

### 5. Seed

```bash
bun run seed                  # loads data/ridership.csv
bun run seed path/to/file.csv # or another CSV
```

This deletes and reinserts all of `ridership_raw` in one transaction, connecting as the table owner. Re-run it after every new extract. The views pick up the new data automatically, so a new data release doesn't need a migration.

### 6. Run the app

```bash
bun dev        # http://localhost:3000
```

### Environment

`.env.local` (gitignored) holds:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: read by the app. The publishable key is safe in the browser because RLS limits what it can do.
- `SUPABASE_DB_PASSWORD`: used only by the seed script, together with the pooler URL that `supabase link` saves in `supabase/.temp/`. Set `SUPABASE_DB_URL` instead to seed a different database.

## How I built this

I used Claude to help plan the architecture and cut the scope down to a weekend's worth of work, and Claude Code to speed up development. I review all of its output and test the code it writes before keeping it.

## Next steps

Analysis
- Make the seasonal check reproducible: a SQL query over `ridership_vs_2019` (or a small script) instead of a one-off calculation, so it can be rerun on each NTD release.
- Test the leisure prediction directly with finer data. NTD's monthly totals can't separate commuting from leisure, but the MBTA's open data portal publishes ridership by day and time of day (for example, subway gated station entries), which would allow comparing weekday peak trips with weekend trips against 2019.
- Seasonal dumbbell chart (summer vs. winter recovery by mode), once the result is clear enough to show on the site.

Pipeline and data
- Make `extract.ts` itself fail on duplicate `mode`/`tos`/`month` rows, not just the CSV test.
- Add ferry (FB) as a fourth mode group.

Database
- SQL sanity check: every mode's 2019 months should average 100%.
- Local Supabase through Docker/OrbStack instead of working only against the hosted project.
- Supabase GitHub integration so migrations deploy from the repo.

App
- Mode toggles on the chart.
- `loading.tsx`.

Testing
- Playwright end-to-end check of the deployed page, including chart interaction (the unit tests can't cover pointer and keyboard use).
