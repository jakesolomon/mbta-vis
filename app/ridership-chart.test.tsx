import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RidershipEvent } from '@/lib/events'
import RidershipChart, { type Series } from './ridership-chart'

// Server render, as on first paint: useParentSize starts at its 720px initial width (not narrow)
const months = ['2019-12-01', '2020-01-01', '2020-02-01', '2020-03-01']
const series: Series[] = [
  { name: 'Bus', points: months.map((month, i) => ({ mode_group: 'Bus', month, trips: 1000 * (i + 1), pct: 0.5 * (i + 1) })) },
  // starts a month late: the table shows a dash for the missing month
  { name: 'Subway', points: months.slice(1).map(month => ({ mode_group: 'Subway', month, trips: 500, pct: 0.25 })) },
]
const events: RidershipEvent[] = [
  { id: 1, start: '2020-01-15', end: '2020-02-10', label: 'Shutdown', detail: 'A span event' },
  { id: 2, start: '2020-03-10', label: 'COVID-19', detail: 'A point event' },
  { id: 3, start: '2024-01-01', label: 'Later', detail: 'Outside the data, so left out' },
]

const render = (evts = events) =>
  renderToStaticMarkup(<RidershipChart title="Test chart" series={series} events={evts} />)
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

test('summarizes the latest month for screen readers', () => {
  const label = decode(render().match(/aria-label="([^"]*)"/)![1])
  expect(label).toBe(
    'Test chart, Mar 2020: Bus 200%, Subway 25% of the 2019 average. ' +
      'Marked events: Shutdown (Jan–Feb 2020), COVID-19 (Mar 2020). ' +
      'Use arrow keys to step through months.',
  )
})

test('draws one line and one legend entry per series', () => {
  const html = render()
  expect(html.match(/<path /g)?.length).toBeGreaterThanOrEqual(2)
  expect(html).toContain('>Bus</li>')
  expect(html).toContain('>Subway</li>')
})

test('labels only the events within the data', () => {
  const html = render()
  expect(html).toContain('>Shutdown</text>')
  expect(html).toContain('>COVID-19</text>')
  expect(html).not.toContain('Later')
})

test('the data table has a row per month, with events by month', () => {
  const table = render().split('<tbody>').at(-1)!
  const rows = table.match(/<tr>.*?<\/tr>/g)!
  expect(rows).toHaveLength(months.length)
  const cells = (row: string) => [...row.matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/g)].map(m => m[1])
  expect(cells(rows[0])).toEqual(['Dec 2019', '1,000', '50%', '–', '–', ''])
  // the detail only in an event's first month
  expect(cells(rows[1])).toEqual(['Jan 2020', '2,000', '100%', '500', '25%', 'Shutdown: A span event'])
  expect(cells(rows[2])).toEqual(['Feb 2020', '3,000', '150%', '500', '25%', 'Shutdown'])
  expect(cells(rows[3])).toEqual(['Mar 2020', '4,000', '200%', '500', '25%', 'COVID-19: A point event'])
})

test('the data table labels each column under its mode, and each row by month', () => {
  const html = render()
  const head = html.split('<thead>')[1].split('</thead>')[0]
  expect(head.match(/scope="colgroup"[^>]*>(Bus|Subway)</g)).toHaveLength(2)
  expect(head.match(/scope="col"[^>]*>Trips</g)).toHaveLength(2)
  expect(head.match(/scope="col"[^>]*>% of 2019</g)).toHaveLength(2)
  expect(html).toContain('<th scope="row"')
  expect(html).toContain('<caption')
})

test('the chart takes keyboard focus as an application, with an empty live region until focused', () => {
  const html = render()
  expect(html).toContain('role="application"')
  expect(html).toContain('aria-roledescription="chart"')
  expect(html).toMatch(/<p aria-live="polite" class="sr-only"><\/p>/)
})

test('without events there is no event column or summary', () => {
  const html = render([])
  expect(html).not.toContain('>Event</th>')
  expect(html).not.toContain('Marked events')
})
