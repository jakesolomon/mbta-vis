// Events annotated on the ridership chart. Dates are YYYY-MM-DD (UTC); `end` makes it a span.
// Editorial, not data, so they live here rather than in Supabase.
export type RidershipEvent = {
  start: string
  end?: string
  label: string // short, drawn on the chart
  detail: string // shown in the tooltip and data table
}

export const EVENTS: RidershipEvent[] = [
  {
    start: '2020-03-10',
    label: 'COVID-19',
    detail: 'Massachusetts declares a state of emergency; ridership collapses',
  },
  {
    start: '2022-08-19',
    end: '2022-09-18',
    label: 'Orange Line shutdown',
    detail: '30-day full Orange Line shutdown for track and signal work',
  },
  {
    start: '2022-12-12',
    label: 'GLX Medford',
    detail: 'Green Line Extension opens the Medford/Tufts branch',
  },
  {
    start: '2023-07-05',
    end: '2023-08-31',
    label: 'Free Blue Line',
    detail: 'Sumner Tunnel closed; Blue Line fares free',
  },
  {
    start: '2025-03-24',
    label: 'South Coast Rail',
    detail: 'Commuter rail service to Fall River and New Bedford begins',
  },
]
