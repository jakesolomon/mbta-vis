import { expect, test } from 'bun:test'
import type { IndexedRidership } from './ridership'
import { summarize, yearAverage } from './summary'

// 24 months from Jan 2023, pct rising 0.01 a month from 0.5, with a dip in Apr 2023
const points: IndexedRidership[] = Array.from({ length: 24 }, (_, i) => {
  const month = `${2023 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`
  return { mode_group: 'Bus', month, trips: 100, pct: i === 3 ? 0.1 : 0.5 + i / 100 }
})

test('averages the last 12 months', () => {
  // Jan–Dec 2024: 0.62 … 0.73
  expect(summarize(points).recent).toBeCloseTo(0.675)
})

test('uses every month when there are fewer than 12', () => {
  expect(summarize(points.slice(0, 3)).recent).toBeCloseTo(0.51)
})

test('finds the latest and lowest months', () => {
  const s = summarize(points)
  expect(s.latest.month).toBe('2024-12-01')
  expect(s.low.month).toBe('2023-04-01')
})

test('throws on an empty series', () => {
  expect(() => summarize([])).toThrow('no points')
})

test('averages a calendar year', () => {
  // 2023: 0.50 … 0.61 with Apr (0.53) replaced by 0.1
  expect(yearAverage(points, 2023)).toBeCloseTo((6.66 - 0.53 + 0.1) / 12)
  expect(yearAverage(points, 2019)).toBeUndefined()
})
