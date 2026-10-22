// Checks the committed data/ridership.csv is something scripts/seed.ts can load and the chart can index.
import { expect, test } from 'bun:test'
import { parseCsv } from '../scripts/seed'

const rows = parseCsv(await Bun.file(`${import.meta.dir}/ridership.csv`).text())

// ridership_monthly's mode groups (see the init migration); DR is excluded there
const GROUPS: Record<string, string[]> = {
  Subway: ['HR', 'LR'],
  Bus: ['MB', 'RB', 'TB'],
  'Commuter rail': ['CR'],
  Ferry: ['FB'],
}
const KNOWN_MODES = new Set([...Object.values(GROUPS).flat(), 'DR'])

test('has rows', () => {
  expect(rows.length).toBeGreaterThan(0)
})

test('every row is well-formed', () => {
  const bad = rows.filter(
    r =>
      !KNOWN_MODES.has(r.mode) ||
      !/^[A-Z]{2}$/.test(r.tos) ||
      !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(r.month) ||
      !Number.isSafeInteger(r.trips) ||
      r.trips < 0,
  )
  expect(bad).toEqual([])
})

test('(mode, tos, month) is unique, matching the primary key', () => {
  const keys = rows.map(r => `${r.mode},${r.tos},${r.month}`)
  expect(new Set(keys).size).toBe(keys.length)
})

// indexTo2019Average throws without all 12 months of 2019
test.each(Object.entries(GROUPS))('%s has all 12 months of 2019', (_, modes) => {
  const months = new Set(rows.filter(r => modes.includes(r.mode) && r.month.startsWith('2019-')).map(r => r.month))
  expect(months.size).toBe(12)
})
