import { expect, test } from 'bun:test'
import { EVENTS } from './events'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isRealDate = (d: string) => ISO_DATE.test(d) && new Date(d).toISOString().startsWith(d)

test.each(EVENTS.map(e => [e.label, e] as const))('%s has valid dates and text', (_, e) => {
  expect(isRealDate(e.start)).toBe(true)
  if (e.end) {
    expect(isRealDate(e.end)).toBe(true)
    expect(e.end > e.start).toBe(true)
  }
  expect(e.label.trim()).not.toBe('')
  expect(e.detail.trim()).not.toBe('')
})

// the chart keys event marks by start date and stacks labels in array order
test('events are in date order with unique start dates', () => {
  const starts = EVENTS.map(e => e.start)
  expect(starts).toEqual([...starts].sort())
  expect(new Set(starts).size).toBe(starts.length)
})
