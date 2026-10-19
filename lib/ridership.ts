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

// Monthly trips per mode group (Subway, Bus, ...) from the ridership_monthly view, oldest first,
// optionally from `since` (YYYY-MM-DD) on.
// Data only changes when scripts/seed.ts reruns, so it's cached for days.
export async function getMonthlyRidership(since = '0001-01-01'): Promise<MonthlyRidership[]> {
  'use cache'
  cacheLife('days')

  const db = supabase()
  const rows: MonthlyRidership[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ridership_monthly')
      .select('mode_group, month, trips')
      .gte('month', since)
      .order('month')
      .order('mode_group')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`ridership_monthly: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

export type IndexedRidership = MonthlyRidership & {
  pct: number // trips / the mode group's average month in 2019; 1 = 100%
}

// One mode group's months, indexed so its 2019 monthly average is 100%.
// `rows` must include all of 2019 for that mode group.
export function indexTo2019Average(rows: MonthlyRidership[], modeGroup: string): IndexedRidership[] {
  const series = rows.filter(r => r.mode_group === modeGroup)
  const baseline = series.filter(r => r.month.startsWith('2019-'))
  if (baseline.length !== 12) throw new Error(`${modeGroup}: expected 12 months of 2019, got ${baseline.length}`)
  const avg = baseline.reduce((sum, r) => sum + r.trips, 0) / 12
  return series.map(r => ({ ...r, pct: r.trips / avg }))
}
