'use client'

import type { MonthlyRidership } from '@/lib/ridership'

// Placeholder that proves the rows reached the client: latest month's trips per mode group.
// To be replaced by the chart.
export default function RidershipSummary({ rows }: { rows: MonthlyRidership[] }) {
  const latest = rows.at(-1)?.month
  const months = new Set(rows.map(r => r.month)).size

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {rows.length} rows · {months} months · {rows[0]?.month} to {latest}
      </p>
      <table className="text-left tabular-nums">
        <thead>
          <tr><th className="pr-8 font-medium">Mode</th><th className="font-medium text-right">Trips ({latest})</th></tr>
        </thead>
        <tbody>
          {rows.filter(r => r.month === latest).map(r => (
            <tr key={r.mode_group}>
              <td className="pr-8">{r.mode_group}</td>
              <td className="text-right">{r.trips.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
