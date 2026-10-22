import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAdmin } from '@/lib/auth'
import { signOut } from './actions'

export const metadata: Metadata = { title: 'Admin · MBTA Ridership', robots: { index: false } }

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      {/* the session is read per request, so it streams in behind the static shell */}
      <Suspense fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">Checking sign-in…</p>}>
        <AdminPanel />
      </Suspense>
    </main>
  )
}

async function AdminPanel() {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as <span className="font-medium text-[var(--foreground)]">{admin.email}</span>
      </p>
      <form action={signOut}>
        <button type="submit" className="underline underline-offset-2">Sign out</button>
      </form>
      <Link href="/" className="underline underline-offset-2">View chart</Link>
    </div>
  )
}
