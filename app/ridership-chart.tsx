'use client'

import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { bisector, max } from 'd3-array'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { localPoint } from '@visx/event'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { useParentSize } from '@visx/responsive'
import { scaleLinear, scaleUtc } from '@visx/scale'
import { Line, LinePath } from '@visx/shape'
import { TooltipWithBounds } from '@visx/tooltip'
import type { IndexedRidership } from '@/lib/ridership'

const HEIGHT = 320
const MARGIN = { top: 16, right: 48, bottom: 32, left: 44 }

// YYYY-MM-DD parses as UTC midnight, so format in UTC too
const date = (p: IndexedRidership) => new Date(p.month)
const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtPct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })
const fmtTrips = new Intl.NumberFormat('en-US')
const bisectMonth = bisector(date).center

const tickLabel = { fill: 'var(--chart-muted)', fontSize: 11, fontFamily: 'inherit' } as const

// Single-series line of monthly ridership as a percent of the 2019 monthly average,
// with a snapping crosshair (pointer or arrow keys) and a table view.
export default function RidershipChart({ title, points }: { title: string; points: IndexedRidership[] }) {
  const { parentRef, width } = useParentSize({ initialSize: { width: 720 } })
  const [active, setActive] = useState<number | null>(null)

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom
  const last = points.at(-1)!
  const x = scaleUtc({ domain: [date(points[0]), date(last)], range: [0, innerW] })
  const y = scaleLinear({ domain: [0, Math.max(1.2, max(points, p => p.pct)!)], range: [innerH, 0], nice: true })
  // a tick each January, every other year when narrow
  const years = points.filter(p => p.month.endsWith('-01-01')).map(date)
  const yearTicks = innerW < 400 ? years.filter((_, i) => i % 2 === 0) : years

  const hovered = active === null ? null : points[active]

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const pt = localPoint(e)
    if (pt) setActive(bisectMonth(points, x.invert(pt.x - MARGIN.left)))
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    setActive(i => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + step)))
  }

  return (
    <figure className="flex flex-col gap-3">
      <figcaption>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Monthly trips as a percent of the 2019 monthly average (100%)
        </p>
      </figcaption>

      <div ref={parentRef} className="relative" style={{ height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title}: ${fmtPct.format(last.pct)} of the 2019 average in ${fmtMonth.format(date(last))}. Use arrow keys to step through months.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive(i => i ?? points.length - 1)}
          onBlur={() => setActive(null)}
          className="overflow-visible rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-series-1)]"
        >
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows scale={y} width={innerW} numTicks={6} stroke="var(--chart-grid)" />
            {/* the 2019 baseline gets a stronger hairline than the grid */}
            <Line from={{ x: 0, y: y(1) }} to={{ x: innerW, y: y(1) }} stroke="var(--chart-axis)" />
            <AxisLeft
              scale={y}
              numTicks={6}
              tickFormat={v => fmtPct.format(Number(v))}
              hideAxisLine
              hideTicks
              tickLabelProps={tickLabel}
            />
            <AxisBottom
              top={innerH}
              scale={x}
              tickValues={yearTicks}
              tickFormat={v => String((v as Date).getUTCFullYear())}
              stroke="var(--chart-axis)"
              tickStroke="var(--chart-axis)"
              tickLabelProps={tickLabel}
            />

            <LinePath
              data={points}
              x={p => x(date(p))}
              y={p => y(p.pct)}
              stroke="var(--chart-series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={x(date(last))}
              cy={y(last.pct)}
              r={4}
              fill="var(--chart-series-1)"
              stroke="var(--background)"
              strokeWidth={2}
            />
            <text x={x(date(last)) + 8} y={y(last.pct)} dy="0.35em" fontSize={12} fill="var(--chart-ink-secondary)">
              {fmtPct.format(last.pct)}
            </text>

            {hovered && (
              <g pointerEvents="none">
                <Line
                  from={{ x: x(date(hovered)), y: 0 }}
                  to={{ x: x(date(hovered)), y: innerH }}
                  stroke="var(--chart-muted)"
                />
                <circle
                  cx={x(date(hovered))}
                  cy={y(hovered.pct)}
                  r={4}
                  fill="var(--chart-series-1)"
                  stroke="var(--background)"
                  strokeWidth={2}
                />
              </g>
            )}
            <rect
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setActive(null)}
            />
          </Group>
        </svg>

        {hovered && (
          <TooltipWithBounds
            left={x(date(hovered)) + MARGIN.left}
            top={y(hovered.pct) + MARGIN.top}
            unstyled
            applyPositionStyle
            className="pointer-events-none rounded-md border border-black/10 bg-[var(--background)] px-3 py-2 text-sm shadow-sm dark:border-white/10"
          >
            <div className="text-[var(--chart-muted)]">{fmtMonth.format(date(hovered))}</div>
            <div className="font-semibold">{fmtPct.format(hovered.pct)} of 2019 avg</div>
            <div className="text-[var(--chart-ink-secondary)]">{fmtTrips.format(hovered.trips)} trips</div>
          </TooltipWithBounds>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Show data table</summary>
        <table className="mt-2 w-full max-w-md tabular-nums">
          <thead>
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="font-medium">Month</th>
              <th className="text-right font-medium">Trips</th>
              <th className="text-right font-medium">% of 2019 avg</th>
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.month}>
                <td>{fmtMonth.format(date(p))}</td>
                <td className="text-right">{fmtTrips.format(p.trips)}</td>
                <td className="text-right">{fmtPct.format(p.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
