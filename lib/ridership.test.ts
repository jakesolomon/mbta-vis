import { describe, expect, mock, test } from 'bun:test'
import type { MonthlyRidership } from './ridership'

// getMonthlyRidership's dependencies: cacheLife only works inside Next, and the client hits the network.
// The fake client serves `table` through a chainable query builder and records each page requested.
let table: MonthlyRidership[] = []
let failWith: string | null = null
const ranges: [number, number][] = []
const query = () => {
  let since = ''
  const q = {
    select: () => q,
    order: () => q,
    gte: (_col: string, v: string) => ((since = v), q),
    range: async (from: number, to: number) => {
      ranges.push([from, to])
      if (failWith) return { data: null, error: { message: failWith } }
      return { data: table.filter(r => r.month >= since).slice(from, to + 1), error: null }
    },
  }
  return q
}
mock.module('next/cache', () => ({ cacheLife: () => {} }))
mock.module('@supabase/supabase-js', () => ({ createClient: () => ({ from: query }) }))
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key'

const { getMonthlyRidership, indexTo2019Average } = await import('./ridership')

const months = (year: number, n = 12) =>
  Array.from({ length: n }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`)
const rowsFor = (mode_group: string, monthList: string[], trips: (i: number) => number): MonthlyRidership[] =>
  monthList.map((month, i) => ({ mode_group, month, trips: trips(i) }))

describe('indexTo2019Average', () => {
  // 2019 averages 100 for Bus (trips 45..155 step 10) and 1000 for Subway
  const rows = [
    ...rowsFor('Bus', [...months(2019), ...months(2020, 3)], i => (i < 12 ? 45 + i * 10 : 50)),
    ...rowsFor('Subway', months(2019), () => 1000),
  ]

  test('indexes each month to the 2019 monthly average', () => {
    const bus = indexTo2019Average(rows, 'Bus')
    expect(bus).toHaveLength(15)
    expect(bus[0]).toEqual({ mode_group: 'Bus', month: '2019-01-01', trips: 45, pct: 0.45 })
    expect(bus.at(-1)!.pct).toBe(0.5)
    expect(bus.slice(0, 12).reduce((s, r) => s + r.pct, 0) / 12).toBeCloseTo(1)
  })

  test('only includes the requested mode group', () => {
    const subway = indexTo2019Average(rows, 'Subway')
    expect(subway.every(r => r.mode_group === 'Subway' && r.pct === 1)).toBe(true)
  })

  test('throws unless all 12 months of 2019 are present', () => {
    expect(() => indexTo2019Average(rows.filter(r => r.month !== '2019-06-01'), 'Bus')).toThrow(
      'Bus: expected 12 months of 2019, got 11',
    )
    expect(() => indexTo2019Average(rows, 'Ferry')).toThrow('got 0')
  })
})

describe('getMonthlyRidership', () => {
  const reset = (rows: MonthlyRidership[]) => {
    table = rows
    failWith = null
    ranges.length = 0
  }

  test('pages past the 1000-row cap until a short page', async () => {
    reset(rowsFor('Bus', Array.from({ length: 2345 }, (_, i) => `2019-01-${i}`), i => i))
    const rows = await getMonthlyRidership()
    expect(rows).toHaveLength(2345)
    expect(rows.at(-1)!.trips).toBe(2344)
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  test('requests one more page when the total is an exact multiple of the page size', async () => {
    reset(rowsFor('Bus', Array.from({ length: 1000 }, (_, i) => `2019-01-${i}`), i => i))
    expect(await getMonthlyRidership()).toHaveLength(1000)
    expect(ranges).toHaveLength(2)
  })

  test('filters from `since`', async () => {
    reset(rowsFor('Bus', [...months(2018), ...months(2019)], i => i))
    const rows = await getMonthlyRidership('2019-01-01')
    expect(rows.map(r => r.month)).toEqual(months(2019))
  })

  test('surfaces PostgREST errors', async () => {
    reset([])
    failWith = 'permission denied'
    await expect(getMonthlyRidership()).rejects.toThrow('ridership_monthly: permission denied')
  })
})
