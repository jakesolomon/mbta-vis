import { describe, expect, test } from 'bun:test'
import { eventMonths, fmtEventDates, hitEvent, monthOf, stackLabels } from './event-layout'

const event = (start: string, end?: string) => ({ id: 1, start, end, label: 'x', detail: 'x' })

test('monthOf', () => {
  expect(monthOf('2022-08-19')).toBe('2022-08-01')
  expect(monthOf('2022-08-01')).toBe('2022-08-01')
})

describe('fmtEventDates', () => {
  test('a point event is its month', () => {
    expect(fmtEventDates(event('2020-03-10'))).toBe('Mar 2020')
  })

  test('formats in UTC, so the first of the month stays in that month', () => {
    expect(fmtEventDates(event('2020-03-01'))).toBe('Mar 2020')
  })

  test('a span within one month is that month', () => {
    expect(fmtEventDates(event('2022-08-01', '2022-08-31'))).toBe('Aug 2022')
  })

  test('a span within one year shares the year', () => {
    expect(fmtEventDates(event('2022-08-19', '2022-09-18'))).toBe('Aug–Sep 2022')
  })

  test('a span across years names both', () => {
    expect(fmtEventDates(event('2022-12-01', '2023-01-15'))).toBe('Dec 2022–Jan 2023')
  })
})

describe('stackLabels', () => {
  test('no labels, no lanes', () => {
    expect(stackLabels([])).toEqual({ lanes: [], count: 0 })
  })

  test('labels that fit side by side share the first lane', () => {
    expect(stackLabels([{ x: 0, width: 50 }, { x: 50, width: 50 }, { x: 120, width: 10 }])).toEqual({
      lanes: [0, 0, 0],
      count: 1,
    })
  })

  test('overlapping labels stack upward', () => {
    expect(stackLabels([{ x: 0, width: 100 }, { x: 10, width: 100 }, { x: 20, width: 100 }])).toEqual({
      lanes: [0, 1, 2],
      count: 3,
    })
  })

  test('a label drops back to the lowest lane that has cleared', () => {
    // lane 0 is busy until 100, lane 1 until 60: the third label (x=70) goes to lane 1, the fourth (x=100) to lane 0
    const { lanes, count } = stackLabels([
      { x: 0, width: 100 },
      { x: 10, width: 50 },
      { x: 70, width: 50 },
      { x: 100, width: 10 },
    ])
    expect(lanes).toEqual([0, 1, 1, 0])
    expect(count).toBe(2)
  })
})

describe('eventMonths', () => {
  const months = ['2022-07-01', '2022-08-01', '2022-09-01', '2022-10-01']

  test('a point event early in a month is under that month', () => {
    expect(eventMonths(event('2022-08-05'), months)).toEqual(new Set(['2022-08-01']))
  })

  test('a point event late in a month is also under the next, whose point is closer', () => {
    expect(eventMonths(event('2022-08-24'), months)).toEqual(new Set(['2022-08-01', '2022-09-01']))
  })

  test('a span is under the months it falls in and the points it covers', () => {
    expect(eventMonths(event('2022-08-19', '2022-09-18'), months)).toEqual(new Set(['2022-08-01', '2022-09-01']))
  })

  test('a short span covering no point is also under the nearest one', () => {
    expect(eventMonths(event('2022-08-20', '2022-08-28'), months)).toEqual(new Set(['2022-08-01', '2022-09-01']))
  })
})

describe('hitEvent', () => {
  const box = (x0: number, x1 = x0) => ({
    x0,
    x1,
    ruleTop: -20,
    labelBox: { left: x0, right: x0 + 50, top: -22, bottom: -8 },
  })
  const boxes = [box(100), box(200, 260)]

  test('near a rule, within the slop', () => {
    expect(hitEvent(boxes, 106, 50, 8)).toBe(0)
    expect(hitEvent(boxes, 94, 50, 8)).toBe(0)
    expect(hitEvent(boxes, 110, 50, 8)).toBe(-1)
  })

  test('anywhere inside a span in the plot, but only near its rule above the plot', () => {
    expect(hitEvent(boxes, 240, 50, 8)).toBe(1)
    expect(hitEvent(boxes, 240, -2, 8)).toBe(-1)
  })

  test('on a label, even past its rule', () => {
    expect(hitEvent(boxes, 140, -15, 8)).toBe(0)
  })

  test('not above where the rule starts', () => {
    expect(hitEvent(boxes, 100, -30, 8)).toBe(-1)
  })

  test('the nearest rule wins', () => {
    expect(hitEvent([box(100), box(110)], 106, 50, 8)).toBe(1)
  })
})
