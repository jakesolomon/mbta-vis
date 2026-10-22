import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseEnv } from './supabase'

// A per-request client that reads and writes the Supabase auth cookies, so queries run as the
// signed-in user. Server Components can't set cookies, so writes there are dropped; proxy.ts
// refreshes the session before /admin renders, and server actions can write them.
export async function authClient() {
  const store = await cookies()
  const { url, key } = supabaseEnv()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: toSet => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // called from a Server Component
        }
      },
    },
  })
}

// The signed-in admin, or null. Sign-ups are disabled, so any valid session is the admin.
// getClaims verifies the JWT, unlike getSession, which trusts the cookie.
// Reads cookies, so callers must sit behind a <Suspense> boundary.
export async function getAdmin(): Promise<{ email: string } | null> {
  const { data } = await (await authClient()).auth.getClaims()
  const email = data?.claims.email
  return email ? { email } : null
}
