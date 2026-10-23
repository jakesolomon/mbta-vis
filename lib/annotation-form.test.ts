import { expect, test } from 'bun:test'
import { LABEL_MAX, parseAnnotation } from './annotation-form'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  Object.entries(fields).forEach(([k, v]) => f.set(k, v))
  return f
}
const valid = { date: '2022-08-19', end_date: '2022-09-18', label: ' Shutdown ', mode_group: 'Subway', detail: ' 30 days ' }

test('trims fields and turns empty optional ones into null', () => {
  expect(parseAnnotation(form(valid))).toEqual({
    data: { date: '2022-08-19', end_date: '2022-09-18', label: 'Shutdown', mode_group: 'Subway', detail: '30 days' },
  })
  expect(parseAnnotation(form({ ...valid, end_date: '', mode_group: '', detail: '  ' }))).toEqual({
    data: { date: '2022-08-19', end_date: null, label: 'Shutdown', mode_group: null, detail: null },
  })
})

test.each([
  ['a missing date', { date: '' }, 'valid date'],
  ['an impossible date', { date: '2022-02-30' }, 'valid date'],
  ['a bad end date', { end_date: 'soon' }, 'valid end date'],
  ['an end date on the date', { end_date: '2022-08-19' }, 'after the date'],
  ['an end date before the date', { end_date: '2022-08-01' }, 'after the date'],
  ['a blank label', { label: '   ' }, 'Enter a label'],
  ['a long label', { label: 'x'.repeat(LABEL_MAX + 1) }, `${LABEL_MAX} characters`],
  ['an unknown mode', { mode_group: 'Monorail' }, 'Pick a mode'],
  ['a mode the chart doesn\'t draw', { mode_group: 'Ferry' }, 'Pick a mode'],
])('rejects %s', (_, override, message) => {
  const result = parseAnnotation(form({ ...valid, ...override }))
  expect('error' in result && result.error).toContain(message)
})
