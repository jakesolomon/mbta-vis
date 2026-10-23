import type { RidershipEvent } from './events'

const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

// YYYY-MM-DD -> the first of its month
export const monthOf = (d: string) => `${d.slice(0, 7)}-01`

// "Mar 2020", or "Aug–Sep 2022" for a span
export function fmtEventDates(e: RidershipEvent) {
  const start = fmtMonth.format(new Date(e.start))
  if (!e.end || monthOf(e.end) === monthOf(e.start)) return start
  const end = fmtMonth.format(new Date(e.end))
  return start.slice(-4) === end.slice(-4) ? `${start.slice(0, -5)}–${end}` : `${start}–${end}`
}

// Stacks labels (in order) into lanes: each takes the lowest lane whose last label ends at or before its x.
// Returns each label's lane and the number of lanes used.
export function stackLabels(labels: { x: number; width: number }[]) {
  const laneEnds: number[] = []
  const lanes = labels.map(({ x, width }) => {
    let lane = laneEnds.findIndex(end => end <= x)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = x + width
    return lane
  })
  return { lanes, count: laneEnds.length }
}

// The months (YYYY-MM-01, from the chart's sorted `months`) an event shows up under in the tooltip:
// the calendar months it falls in, plus the points it's drawn over, or the point nearest to it.
// So an event late in March also shows under April, whose point sits closer to its rule.
export function eventMonths(e: RidershipEvent, months: string[]) {
  const end = e.end ?? e.start
  const inMonth = months.filter(m => monthOf(e.start) <= m && m <= monthOf(end))
  const drawnOver = months.filter(m => e.start <= m && m <= end)
  const t = Date.parse(e.start)
  const nearest = months.reduce<string | undefined>(
    (best, m) => (best === undefined || Math.abs(Date.parse(m) - t) < Math.abs(Date.parse(best) - t) ? m : best),
    undefined,
  )
  return new Set([...inMonth, ...(drawnOver.length || !nearest ? drawnOver : [nearest])])
}

export type EventHitBox = {
  x0: number // rule (and span start)
  x1: number // span end, or x0
  ruleTop: number // where the rule starts above the plot (negative)
  labelBox: { left: number; right: number; top: number; bottom: number }
}

// Which event (index) the pointer at (px, py) in plot coordinates is on, or -1: its label,
// within `slop` px of its rule, or (inside the plot, y >= 0) within its span. The nearest wins.
export function hitEvent(boxes: EventHitBox[], px: number, py: number, slop: number) {
  const onLabel = boxes.findIndex(
    ({ labelBox: l }) => l.left <= px && px <= l.right && l.top <= py && py <= l.bottom,
  )
  if (onLabel !== -1) return onLabel
  let hit = -1
  let best = Infinity
  boxes.forEach((b, i) => {
    if (py < b.ruleTop) return
    const right = py >= 0 ? b.x1 : b.x0
    const d = px < b.x0 ? b.x0 - px : px > right ? px - right : 0
    if (d <= slop && d < best) {
      hit = i
      best = d
    }
  })
  return hit
}
