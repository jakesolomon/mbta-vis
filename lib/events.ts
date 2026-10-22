import { cacheLife, cacheTag } from 'next/cache'
import { supabase } from './supabase'

// An annotation on the ridership chart. Dates are YYYY-MM-DD (UTC); `end` makes it a span.
export type RidershipEvent = {
  id: number
  start: string
  end?: string
  label: string // short, drawn on the chart
  detail?: string // shown in the tooltip, narrow-screen list and data table
}

// Every annotation from the annotations table, oldest first (the chart stacks labels in this order).
// Cached like the ridership data; adding or deleting one should revalidateTag('annotations').
// One request is enough: PostgREST's 1000-row cap is far beyond a chart's worth of labels.
export async function getEvents(): Promise<RidershipEvent[]> {
  'use cache'
  cacheLife('days')
  cacheTag('annotations')

  const { data, error } = await supabase()
    .from('annotations')
    .select('id, date, end_date, label, detail')
    .order('date')
    .order('id')
  if (error) throw new Error(`annotations: ${error.message}`)
  return data.map(r => ({
    id: r.id,
    start: r.date,
    ...(r.end_date && { end: r.end_date }),
    label: r.label,
    ...(r.detail && { detail: r.detail }),
  }))
}
