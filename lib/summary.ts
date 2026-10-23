import type { IndexedRidership } from './ridership'

export type Summary = {
  recent: number // average pct over the last 12 months of data (or all of it, if shorter)
  latest: IndexedRidership // the last month
  low: IndexedRidership // the lowest month
}

// Headline numbers for one mode's indexed series (see indexTo2019Average), oldest month first
export function summarize(points: IndexedRidership[]): Summary {
  if (points.length === 0) throw new Error('summarize: no points')
  const recent = points.slice(-12)
  return {
    recent: recent.reduce((sum, p) => sum + p.pct, 0) / recent.length,
    latest: points.at(-1)!,
    low: points.reduce((a, b) => (b.pct < a.pct ? b : a)),
  }
}

// Average pct over one calendar year, or undefined if the series has no months in it
export function yearAverage(points: IndexedRidership[], year: number): number | undefined {
  const inYear = points.filter(p => p.month.startsWith(`${year}-`))
  return inYear.length ? inYear.reduce((sum, p) => sum + p.pct, 0) / inYear.length : undefined
}
