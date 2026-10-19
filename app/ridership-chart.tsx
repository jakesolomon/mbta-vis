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

export type Series = { name: string; points: IndexedRidership[] }

const HEIGHT = 320
const MARGIN = { top: 16, right: 112, bottom: 32, left: 44 }
const NARROW_MARGIN_RIGHT = 16
// categorical slots from globals.css, assigned by series order (never cycled)
const COLORS = ['var(--chart-series-1)', 'var(--chart-series-2)', 'var(--chart-series-3)']
// end labels closer than this would collide, so they give way to the legend + tooltip
const MIN_LABEL_GAP = 14

// YYYY-MM-DD parses as UTC midnight, so format in UTC too
const date = (p: { month: string }) => new Date(p.month)
const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtPct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })
const fmtTrips = new Intl.NumberFormat('en-US')
const bisectMonth = bisector(date).center

const tickLabel = { fill: 'var(--chart-muted)', fontSize: 11, fontFamily: 'inherit' } as const

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
}

// Monthly ridership lines (one per series) as a percent of each series' own 2019 monthly average,
// with a legend, end labels, a snapping crosshair (pointer or arrow keys) and a table view.
export default function RidershipChart({ title, series }: { title: string; series: Series[] }) {
  const { parentRef, width } = useParentSize({ initialSize: { width: 720 } })
  const [active, setActive] = useState<number | null>(null)

  // the x positions the crosshair snaps to; series are looked up by month so they needn't align
  const months = [...new Set(series.flatMap(s => s.points.map(p => p.month)))].sort().map(month => ({ month }))
  const byMonth = series.map(s => new Map(s.points.map(p => [p.month, p])))

  const narrow = width < 480
  const margin = narrow ? { ...MARGIN, right: NARROW_MARGIN_RIGHT } : MARGIN
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = HEIGHT - margin.top - margin.bottom
  const x = scaleUtc({ domain: [date(months[0]), date(months.at(-1)!)], range: [0, innerW] })
  const yMax = max(series.flatMap(s => s.points), p => p.pct) ?? 1
  const y = scaleLinear({ domain: [0, Math.max(1.2, yMax)], range: [innerH, 0], nice: true })
  // a tick each January, every other year when narrow
  const years = months.filter(m => m.month.endsWith('-01-01')).map(date)
  const yearTicks = innerW < 400 ? years.filter((_, i) => i % 2 === 0) : years

  const ends = series.map(s => s.points.at(-1)!)
  const endYs = ends.map(p => y(p.pct)).sort((a, b) => a - b)
  const showEndLabels = !narrow && endYs.every((v, i) => i === 0 || v - endYs[i - 1] >= MIN_LABEL_GAP)

  const hovered = active === null ? null : months[active]
  const hoveredPoints = hovered ? byMonth.map(m => m.get(hovered.month)) : []

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const pt = localPoint(e)
    if (pt) setActive(bisectMonth(months, x.invert(pt.x - margin.left)))
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    setActive(i => Math.min(months.length - 1, Math.max(0, (i ?? months.length - 1) + step)))
  }

  const summary = series.map((s, i) => `${s.name} ${fmtPct.format(ends[i].pct)}`).join(', ')

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Monthly trips as a percent of each mode&apos;s 2019 monthly average (100%)
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--chart-ink-secondary)]">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <Swatch color={COLORS[i]} />
              {s.name}
            </li>
          ))}
        </ul>
      </figcaption>

      <div ref={parentRef} className="relative" style={{ height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title}, ${fmtMonth.format(date(months.at(-1)!))}: ${summary} of the 2019 average. Use arrow keys to step through months.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive(i => i ?? months.length - 1)}
          onBlur={() => setActive(null)}
          className="overflow-visible rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-series-1)]"
        >
          <Group left={margin.left} top={margin.top}>
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

            {series.map((s, i) => (
              <g key={s.name}>
                <LinePath
                  data={s.points}
                  x={p => x(date(p))}
                  y={p => y(p.pct)}
                  stroke={COLORS[i]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx={x(date(ends[i]))}
                  cy={y(ends[i].pct)}
                  r={4}
                  fill={COLORS[i]}
                  stroke="var(--background)"
                  strokeWidth={2}
                />
                {showEndLabels && (
                  <text
                    x={x(date(ends[i])) + 8}
                    y={y(ends[i].pct)}
                    dy="0.35em"
                    fontSize={12}
                    fill="var(--chart-ink-secondary)"
                  >
                    {s.name} {fmtPct.format(ends[i].pct)}
                  </text>
                )}
              </g>
            ))}

            {hovered && (
              <g pointerEvents="none">
                <Line
                  from={{ x: x(date(hovered)), y: 0 }}
                  to={{ x: x(date(hovered)), y: innerH }}
                  stroke="var(--chart-muted)"
                />
                {hoveredPoints.map((p, i) => p && (
                  <circle
                    key={series[i].name}
                    cx={x(date(p))}
                    cy={y(p.pct)}
                    r={4}
                    fill={COLORS[i]}
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                ))}
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
            left={x(date(hovered)) + margin.left}
            top={margin.top + innerH / 3}
            unstyled
            applyPositionStyle
            className="pointer-events-none rounded-md border border-black/10 bg-[var(--background)] px-3 py-2 text-sm shadow-sm dark:border-white/10"
          >
            <div className="mb-1 text-[var(--chart-muted)]">{fmtMonth.format(date(hovered))}</div>
            <table className="tabular-nums">
              <tbody>
                {hoveredPoints.map((p, i) => p && (
                  <tr key={series[i].name}>
                    <td className="pr-3"><span className="flex items-center gap-1.5"><Swatch color={COLORS[i]} />{series[i].name}</span></td>
                    <td className="pr-3 text-right font-semibold">{fmtPct.format(p.pct)}</td>
                    <td className="text-right text-[var(--chart-ink-secondary)]">{fmtTrips.format(p.trips)} trips</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipWithBounds>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Show data table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="text-zinc-600 dark:text-zinc-400">
                <th className="text-left font-medium">Month</th>
                {series.map(s => (
                  <th key={s.name} colSpan={2} className="pl-6 text-right font-medium">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month}>
                  <td className="whitespace-nowrap">{fmtMonth.format(date(m))}</td>
                  {byMonth.map((b, i) => {
                    const p = b.get(m.month)
                    return [
                      <td key={`${series[i].name}-trips`} className="pl-6 text-right">{p ? fmtTrips.format(p.trips) : '–'}</td>,
                      <td key={`${series[i].name}-pct`} className="pl-3 text-right">{p ? fmtPct.format(p.pct) : '–'}</td>,
                    ]
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
