import { getEvents } from '@/lib/events'
import { MODES } from '@/lib/modes'
import { getMonthlyRidership, indexTo2019Average } from '@/lib/ridership'
import { repoFile } from '@/lib/site'
import { summarize, yearAverage } from '@/lib/summary'
import ExternalLink from './external-link'
import RidershipChart from './ridership-chart'

// route bullets, in MODES order (full class names so Tailwind generates them)
const BULLETS = [
  { text: 'CR', className: 'bg-chart-series-1 text-chart-series-1-ink' },
  { text: 'BUS', className: 'bg-chart-series-2 text-chart-series-2-ink' },
  { text: 'SUB', className: 'bg-chart-series-3 text-chart-series-3-ink' },
]

const fmtPct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })
const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtMonthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const month = (p: { month: string }, fmt = fmtMonth) => fmt.format(new Date(p.month))

const code = 'font-mono text-xs [overflow-wrap:anywhere]'
// the underline is what sets these apart from the <code> beside them, so it has to be visible (6:1 on the panel)
const codeLink = `${code} underline decoration-muted underline-offset-2 hover:decoration-current`

// the data pipeline, in order, drawn as stops on a line
const ROUTE = [
  { stop: 'NTD workbook', body: <>FTA monthly ridership, <code className={code}>UPT</code> sheet</> },
  {
    stop: 'Extract',
    body: <><ExternalLink href={repoFile('scripts/extract.ts')} className={codeLink}>scripts/extract.ts</ExternalLink> → <ExternalLink href={repoFile('data/ridership.csv')} className={codeLink}>ridership.csv</ExternalLink></>,
  },
  {
    stop: 'Seed',
    body: <><ExternalLink href={repoFile('scripts/seed.ts')} className={codeLink}>scripts/seed.ts</ExternalLink> → Supabase <code className={code}>ridership_raw</code></>,
  },
  {
    stop: 'Group',
    body: <>SQL view <ExternalLink href={repoFile('supabase/migrations/20261018171912_init.sql')} className={codeLink}>ridership_monthly</ExternalLink></>,
  },
  {
    stop: 'Chart',
    body: <>Cached server component, drawn with visx in <ExternalLink href={repoFile('app/ridership-chart.tsx')} className={codeLink}>ridership-chart.tsx</ExternalLink></>,
  },
]

export default async function Home() {
  const [rows, events] = await Promise.all([getMonthlyRidership('2019-01-01'), getEvents()])
  const series = MODES.map(name => ({ name, points: indexTo2019Average(rows, name) }))
  const stats = series.map(s => summarize(s.points))
  const [rail, bus, subway] = stats
  const latest = stats[0].latest
  const windowStart = series[0].points.at(-12) ?? series[0].points[0]
  const subway2023 = yearAverage(series[2].points, 2023)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pt-10 pb-16 sm:px-7">
      <div>
        <p className="eyebrow text-muted">
          MBTA monthly trips vs. 2019 · through {month(latest)}
        </p>
        {/* The headline and the reasoning below are written for the data through Aug 2026. */}
        <h1 className="mt-2 max-w-[18ch] text-4xl font-extrabold leading-display tracking-display text-balance sm:text-5xl">
          Commuter rail is back. The subway isn&apos;t.
        </h1>
        <p className="mt-3.5 max-w-[60ch] text-lg leading-normal text-muted">
          Six years after the pandemic emptied the system, the MBTA&apos;s three main modes have recovered at very
          different rates.
        </p>
      </div>

      <figure>
        <figcaption id="stats-caption" className="eyebrow mb-2 text-muted">
          Average of the last 12 months ({month(windowStart)}–{month(latest)}) as a share of 2019
        </figcaption>
        <ul aria-labelledby="stats-caption" className="grid border-2 border-foreground sm:grid-cols-3">
          {series.map((s, i) => (
            <li
              key={s.name}
              className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 border-foreground px-4 py-3.5 not-first:border-t-2 sm:not-first:border-t-0 sm:not-first:border-l-2"
            >
              <span
                aria-hidden="true"
                className={`row-span-2 grid size-11 place-items-center rounded-full text-caption font-extrabold ${BULLETS[i].className}`}
              >
                {BULLETS[i].text}
              </span>
              <span className="text-stat font-extrabold tabular-nums">{fmtPct.format(stats[i].recent)}</span>
              <span className="text-caption text-muted">
                <span className="sr-only">{s.name}: </span>Lowest month {fmtPct.format(stats[i].low.pct)}, {month(stats[i].low)}
              </span>
            </li>
          ))}
        </ul>
      </figure>

      <RidershipChart title="Ridership by mode since 2019" series={series} events={events} />

      <div className="grid gap-6 text-base leading-relaxed sm:grid-cols-2">
        <p>
          Over the twelve months through {month(latest, fmtMonthLong)}, commuter rail averaged{' '}
          {fmtPct.format(rail.recent)} of its 2019 ridership, and in the latest month it was at{' '}
          {fmtPct.format(rail.latest.pct)}. Buses averaged {fmtPct.format(bus.recent)}. The subway, the system&apos;s
          busiest mode before the pandemic, averaged {fmtPct.format(subway.recent)}.
        </p>
        <p>
          That&apos;s the reverse of what I expected going in. Commuter rail is the most nine-to-five mode, so it should
          have lost the most to remote work. It did bottom out at {fmtPct.format(rail.low.pct)} in{' '}
          {month(rail.low, fmtMonthLong)}, but it has come all the way back. The gap that remains is on the subway
          {subway2023 !== undefined && <>, which averaged {fmtPct.format(subway2023)} in 2023</>}.
        </p>
      </div>

      <section id="how" aria-labelledby="how-heading" className="scroll-mt-6 bg-panel px-6 py-6">
        <h2 id="how-heading" className="eyebrow">How it&apos;s built</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">
          Each line is a mode&apos;s monthly trips divided by its own 2019 monthly average, so 100% means back to
          normal for that mode. Subway is heavy plus light rail; bus is motor, rapid and trolley bus. The RIDE and
          ferries are left out.
        </p>
        <ol className="relative mt-6 grid gap-3.5 before:absolute before:inset-y-2.5 before:left-2 before:w-1 before:bg-foreground sm:grid-cols-5 sm:gap-0 sm:before:inset-x-2.5 sm:before:top-2 sm:before:bottom-auto sm:before:h-1 sm:before:w-auto">
          {ROUTE.map(r => (
            <li key={r.stop} className="relative min-w-0 pl-8 text-caption leading-snug sm:pt-8 sm:pr-2.5 sm:pl-0">
              <span aria-hidden="true" className="absolute top-0 left-0 size-5 rounded-full border-4 border-foreground bg-background" />
              <strong className="block text-sm">{r.stop}</strong>
              {r.body}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
