import { expect, test } from 'bun:test'
import { parseCsv } from './seed'

test('parses rows with numeric trips', () => {
  expect(parseCsv('mode,tos,month,trips\nHR,DO,2019-01-01,100\nCR,PT,2019-02-01,5\n')).toEqual([
    { mode: 'HR', tos: 'DO', month: '2019-01-01', trips: 100 },
    { mode: 'CR', tos: 'PT', month: '2019-02-01', trips: 5 },
  ])
})

test('a header with no rows is empty', () => {
  expect(parseCsv('mode,tos,month,trips\n')).toEqual([])
})

test('rejects an unexpected header', () => {
  expect(() => parseCsv('mode,month,trips\nHR,2019-01-01,1', 'x.csv')).toThrow('unexpected header in x.csv')
})
