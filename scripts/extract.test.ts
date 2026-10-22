import { describe, expect, test } from 'bun:test'
import * as XLSX from 'xlsx'
import { extractCsv, toMonth } from './extract'

describe('toMonth', () => {
  test('Excel serial dates', () => {
    expect(toMonth(43466)).toBe('2019-01-01') // 2019-01-01
    expect(toMonth(43830)).toBe('2019-12-01') // 2019-12-31
  })

  test('M/YYYY headers', () => {
    expect(toMonth('1/2019')).toBe('2019-01-01')
    expect(toMonth('12/2019')).toBe('2019-12-01')
  })

  test('anything else is not a month', () => {
    for (const h of ['NTD ID', 'Mode', '2019', '1/19', '13-2019', '', undefined]) expect(toMonth(h)).toBeNull()
  })
})

describe('extractCsv', () => {
  const head = ['NTD ID', 'Agency', 'Mode', 'TOS', '1/2019', '2/2019', 'Notes']
  const sheet = [
    head,
    [10003, 'MBTA', 'HR', 'DO', 100, '1,234', 'x'],
    ['10003', 'MBTA', 'CR', 'PT', 5, '', 'x'],
    [20008, 'Elsewhere', 'MB', 'DO', 999, 999, 'x'],
    [10003, 'MBTA', 'MB', 'DO', 7],
  ]

  test('writes long-format rows for MBTA only, skipping blank cells', () => {
    expect(extractCsv(sheet)).toEqual([
      'mode,tos,month,trips',
      'HR,DO,2019-01-01,100',
      'HR,DO,2019-02-01,1234',
      'CR,PT,2019-01-01,5',
      'MB,DO,2019-01-01,7',
    ])
  })

  test('throws when an expected column is missing', () => {
    expect(() => extractCsv([['Agency', 'Mode', 'TOS', '1/2019']])).toThrow('no "NTD ID"')
  })

  test('reads a workbook the way the script does, with date-typed month headers', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['NTD ID', 'Mode', 'TOS', new Date(Date.UTC(2019, 0, 1)), new Date(Date.UTC(2019, 1, 1))],
      [10003, 'LR', 'DO', 10, 20],
    ])
    const wb = XLSX.read(XLSX.write({ SheetNames: ['UPT'], Sheets: { UPT: ws } }, { type: 'buffer' }))
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.UPT, { header: 1, raw: true })
    expect(extractCsv(rows)).toEqual(['mode,tos,month,trips', 'LR,DO,2019-01-01,10', 'LR,DO,2019-02-01,20'])
  })
})
