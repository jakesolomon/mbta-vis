import { expect, mock, test } from 'bun:test'

// getEvents' dependencies, faked as in ridership.test.ts: a chainable builder over `rows`
type Row = { id: number; date: string; end_date: string | null; label: string; detail: string | null }
let rows: Row[] = []
let failWith: string | null = null
const orders: string[] = []
const query = () => {
  const q = {
    select: () => q,
    order: (col: string) => (orders.push(col), q),
    then: (resolve: (r: unknown) => void) =>
      resolve(failWith ? { data: null, error: { message: failWith } } : { data: rows, error: null }),
  }
  return q
}
mock.module('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
mock.module('@supabase/supabase-js', () => ({ createClient: () => ({ from: query }) }))
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key'

const { getEvents } = await import('./events')

test('maps rows to chart events, leaving out empty end dates and details', async () => {
  rows = [
    { id: 1, date: '2020-03-10', end_date: null, label: 'COVID-19', detail: 'A point' },
    { id: 2, date: '2022-08-19', end_date: '2022-09-18', label: 'Shutdown', detail: null },
  ]
  failWith = null
  orders.length = 0
  expect(await getEvents()).toEqual([
    { id: 1, start: '2020-03-10', label: 'COVID-19', detail: 'A point' },
    { id: 2, start: '2022-08-19', end: '2022-09-18', label: 'Shutdown' },
  ])
  // oldest first, ties in insertion order, since labels stack in array order
  expect(orders).toEqual(['date', 'id'])
})

test('surfaces PostgREST errors', async () => {
  failWith = 'permission denied'
  await expect(getEvents()).rejects.toThrow('annotations: permission denied')
})
