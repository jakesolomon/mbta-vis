import { cacheLife } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

export type MonthlyRidership = {
  mode_group: string
  month: string // YYYY-MM-DD, first of the month
  trips: number
}

const supabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

// PostgREST caps each response at max_rows (1000), so page through the view
const PAGE = 1000

// Monthly trips per mode group (Subway, Bus, ...) from the ridership_monthly view, oldest first.
// Data only changes when scripts/seed.ts reruns, so it's cached for days.
export async function getMonthlyRidership(): Promise<MonthlyRidership[]> {
  'use cache'
  cacheLife('days')

  const db = supabase()
  const rows: MonthlyRidership[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ridership_monthly')
      .select('mode_group, month, trips')
      .order('month')
      .order('mode_group')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`ridership_monthly: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}
