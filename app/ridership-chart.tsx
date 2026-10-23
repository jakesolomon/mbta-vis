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
import { eventMonths, fmtEventDates, hitEvent, monthOf, stackLabels } from '@/lib/event-layout'
import type { RidershipEvent } from '@/lib/events'
import type { IndexedRidership } from '@/lib/ridership'

export type Series = { name: string; points: IndexedRidership[] }

const HEIGHT = 320
const MARGIN = { top: 16, right: 112, bottom: 32, left: 44 }
const NARROW_MARGIN_RIGHT = 16
// categorical slots from globals.css, assigned by series order (never cycled)
const COLORS = ['var(--chart-series-1)', 'var(--chart-series-2)', 'var(--chart-series-3)']
// end labels closer than this would collide, so they give way to the legend + tooltip
const MIN_LABEL_GAP = 14
// event labels stack in lanes above the plot, each after a stop marker; width is estimated from the
// 11px bold label font
const LANE_H = 16
const CHAR_W = 6.6
const STOP_R = 4.5
const LABEL_X = 9 // label start, right of the stop
const LABEL_PAD = 12 + LABEL_X
// how far either side of an event's rule still counts as hovering it
const EVENT_SLOP = 8

// YYYY-MM-DD parses as UTC midnight, so format in UTC too
const date = (p: { month: string }) => new Date(p.month)
const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtPct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })
const fmtTrips = new Intl.NumberFormat('en-US')
const bisectMonth = bisector(date).center

const tickLabel = { fill: 'var(--chart-muted)', fontSize: 11, fontFamily: 'inherit' } as const

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-1 w-4 shrink-0" style={{ background: color }} />
}

// Monthly ridership lines (one per series) as a percent of each series' own 2019 monthly average,
// with a legend, end labels, event annotations, a snapping crosshair (pointer or arrow keys)
// and a table view.
export default function RidershipChart({
  title,
  series,
  events = [],
}: {
  title: string
  series: Series[]
  events?: RidershipEvent[]
}) {
  const { parentRef, width } = useParentSize({ initialSize: { width: 720 } })
  const [active, setActive] = useState<number | null>(null)

  // the x positions the crosshair snaps to; series are looked up by month so they needn't align
  const months = [...new Set(series.flatMap(s => s.points.map(p => p.month)))].sort().map(month => ({ month }))
  const byMonth = series.map(s => new Map(s.points.map(p => [p.month, p])))

  const narrow = width < 480
  const marginRight = narrow ? NARROW_MARGIN_RIGHT : MARGIN.right
  const innerW = Math.max(0, width - MARGIN.left - marginRight)
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = scaleUtc({ domain: [date(months[0]), date(months.at(-1)!)], range: [0, innerW] })

  // events are drawn at their real dates; the table lists them under the months they fall in, the tooltip
  // also under the nearest month point (see eventMonths);
  // when narrow, labels become numbers keyed to a list under the chart
  const first = months[0].month
  const last = months.at(-1)!.month
  const shown = events.filter(e => monthOf(e.end ?? e.start) >= first && monthOf(e.start) <= last)
  const eventsIn = (month: string) =>
    shown.filter(e => monthOf(e.start) <= month && month <= monthOf(e.end ?? e.start))
  const labeled = shown.map((e, i) => ({ ...e, x0: x(new Date(e.start)), text: narrow ? String(i + 1) : e.label }))
  const stacked = stackLabels(labeled.map(m => ({ x: m.x0, width: m.text.length * CHAR_W + LABEL_PAD })))
  const monthKeys = months.map(m => m.month)
  const marks = labeled.map((m, i) => {
    const labelY = -6 - stacked.lanes[i] * LANE_H
    return {
      ...m,
      x1: m.end ? x(new Date(m.end)) : m.x0,
      labelY,
      ruleTop: labelY - 4, // the stop's center; the rule runs down from it
      labelBox: { left: m.x0 - STOP_R, right: m.x0 + LABEL_X + m.text.length * CHAR_W, top: labelY - 11, bottom: labelY + 3 },
      months: eventMonths(m, monthKeys),
    }
  })
  const bandH = stacked.count * LANE_H
  const margin = { ...MARGIN, top: MARGIN.top + bandH, right: marginRight }
  const height = HEIGHT + bandH
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
  const hoveredEvents = hovered ? marks.filter(m => m.months.has(hovered.month)) : []
  const isHovered = (m: (typeof marks)[number]) => hoveredEvents.includes(m)

  // on an event's label or near its rule, the crosshair snaps to one of that event's months
  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const pt = localPoint(e)
    if (!pt) return
    const px = pt.x - margin.left
    let i = bisectMonth(months, x.invert(px))
    const hit = hitEvent(marks, px, pt.y - margin.top, EVENT_SLOP)
    if (hit !== -1 && !marks[hit].months.has(months[i].month)) {
      const own = [...marks[hit].months].map(m => monthKeys.indexOf(m))
      i = own.reduce((a, b) => (Math.abs(x(date(months[b])) - px) < Math.abs(x(date(months[a])) - px) ? b : a))
    }
    setActive(i)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    setActive(i => Math.min(months.length - 1, Math.max(0, (i ?? months.length - 1) + step)))
  }

  const summary = series.map((s, i) => `${s.name} ${fmtPct.format(ends[i].pct)}`).join(', ')
  const eventSummary = shown.length
    ? ` Marked events: ${shown.map(e => `${e.label} (${fmtEventDates(e)})`).join(', ')}.`
    : ''

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-caption text-muted">
            Monthly trips as a percent of each mode&apos;s 2019 monthly average (100%)
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption font-medium text-chart-ink-secondary">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <Swatch color={COLORS[i]} />
              {s.name}
            </li>
          ))}
        </ul>
      </figcaption>

      <div ref={parentRef} className="relative" style={{ height }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title}, ${fmtMonth.format(date(months.at(-1)!))}: ${summary} of the 2019 average.${eventSummary} Use arrow keys to step through months.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive(i => i ?? months.length - 1)}
          onBlur={() => setActive(null)}
          className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <Group left={margin.left} top={margin.top}>
            {/* event spans and rules sit under everything; rules run up to their stop */}
            {marks.map(m => (
              <g key={m.id}>
                {m.end && (
                  <rect
                    x={m.x0}
                    width={Math.max(2, m.x1 - m.x0)}
                    height={innerH}
                    fill="var(--chart-grid)"
                    opacity={isHovered(m) ? 1 : 0.6}
                  />
                )}
                {/* darker while the event is in the tooltip */}
                <Line
                  from={{ x: m.x0, y: m.ruleTop }}
                  to={{ x: m.x0, y: innerH }}
                  stroke="var(--foreground)"
                  strokeOpacity={isHovered(m) ? 0.9 : 0.3}
                  strokeWidth={1}
                />
              </g>
            ))}
            {/* stops and labels after the rules, haloed so a later event's rule passes behind them;
                the stop fills in while the event is in the tooltip */}
            {marks.map(m => (
              <g key={m.id}>
                <circle
                  cx={m.x0}
                  cy={m.ruleTop}
                  r={STOP_R}
                  fill={isHovered(m) ? 'var(--foreground)' : 'var(--background)'}
                  stroke="var(--foreground)"
                  strokeWidth={2.5}
                />
                <text
                  x={m.x0 + LABEL_X}
                  y={m.labelY}
                  fontSize={11}
                  fontWeight={700}
                  fill={isHovered(m) ? 'var(--foreground)' : 'var(--chart-ink-secondary)'}
                  stroke="var(--background)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {m.text}
                </text>
              </g>
            ))}
            <GridRows scale={y} width={innerW} numTicks={6} stroke="var(--chart-grid)" />
            {/* the 2019 baseline, dashed in ink over the grid */}
            <Line from={{ x: 0, y: y(1) }} to={{ x: innerW, y: y(1) }} stroke="var(--chart-axis)" strokeDasharray="5 4" />
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
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx={x(date(ends[i]))}
                  cy={y(ends[i].pct)}
                  r={5}
                  fill={COLORS[i]}
                  stroke="var(--background)"
                  strokeWidth={2}
                />
                {showEndLabels && (
                  <text
                    x={x(date(ends[i])) + 9}
                    y={y(ends[i].pct)}
                    dy="0.35em"
                    fontSize={12}
                    fill="var(--chart-ink-secondary)"
                  >
                    <tspan fontWeight={700} fill={COLORS[i]}>{s.name}</tspan> {fmtPct.format(ends[i].pct)}
                  </text>
                )}
              </g>
            ))}

            {hovered && (
              <g pointerEvents="none">
                <Line
                  from={{ x: x(date(hovered)), y: 0 }}
                  to={{ x: x(date(hovered)), y: innerH }}
                  stroke="var(--foreground)"
                />
                {hoveredPoints.map((p, i) => p && (
                  <circle
                    key={series[i].name}
                    cx={x(date(p))}
                    cy={y(p.pct)}
                    r={5}
                    fill={COLORS[i]}
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )}
            {/* reaches up over the event labels so they can be hovered too */}
            <rect
              y={-bandH - 4}
              width={innerW}
              height={innerH + bandH + 4}
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
            className="pointer-events-none border-2 border-foreground bg-background px-3 py-2 text-sm"
          >
            <div className="mb-1 font-bold">{fmtMonth.format(date(hovered))}</div>
            <table className="tabular-nums">
              <tbody>
                {hoveredPoints.map((p, i) => p && (
                  <tr key={series[i].name}>
                    <td className="pr-3"><span className="flex items-center gap-1.5"><Swatch color={COLORS[i]} />{series[i].name}</span></td>
                    <td className="pr-3 text-right font-semibold">{fmtPct.format(p.pct)}</td>
                    <td className="text-right text-chart-ink-secondary">{fmtTrips.format(p.trips)} trips</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hoveredEvents.map(e => (
              <p key={e.id} className="mt-2 max-w-64 border-t border-rule pt-2 text-chart-ink-secondary">
                <span className="font-medium text-foreground">{e.label}</span>
                <span className="text-chart-muted"> ({fmtEventDates(e)})</span>
                {e.detail && ` · ${e.detail}`}
              </p>
            ))}
          </TooltipWithBounds>
        )}
      </div>

      {narrow && marks.length > 0 && (
        <ol className="flex flex-col gap-1 text-sm text-chart-ink-secondary">
          {marks.map(m => (
            <li key={m.id} className="flex gap-2">
              <span className="w-3 shrink-0 text-right tabular-nums text-chart-muted">{m.text}</span>
              <span>
                <span className="font-medium text-foreground">{m.label}</span> ({fmtEventDates(m)}){m.detail && ` · ${m.detail}`}
              </span>
            </li>
          ))}
        </ol>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted hover:text-foreground">Show data table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="border-b-2 border-foreground">
                <th className="py-1 text-left font-bold">Month</th>
                {series.map(s => (
                  <th key={s.name} colSpan={2} className="py-1 pl-6 text-right font-bold">{s.name}</th>
                ))}
                {shown.length > 0 && <th className="py-1 pl-6 text-left font-bold">Event</th>}
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
                  {shown.length > 0 && (
                    <td className="whitespace-nowrap pl-6">{eventsIn(m.month).map(e => e.label).join(', ')}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
