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
