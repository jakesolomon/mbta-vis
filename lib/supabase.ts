import { createClient } from '@supabase/supabase-js'

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  return { url, key }
}

// Server-side reads with the publishable key and no session, so they run as anon and RLS applies.
// Safe inside 'use cache'; for anything that depends on who's signed in, use lib/auth.ts.
export const supabase = () => {
  const { url, key } = supabaseEnv()
  return createClient(url, key, { auth: { persistSession: false } })
}
