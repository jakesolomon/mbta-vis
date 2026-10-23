import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import type { Annotation } from '@/lib/annotation-form'
import { authClient, getAdmin } from '@/lib/auth'
import { signOut } from './actions'
import AnnotationsTable from './annotations-table'

export const metadata: Metadata = { title: 'Admin · MBTA Ridership', robots: { index: false } }

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-10 pb-16 sm:px-7">
      <h1 className="text-3xl font-extrabold tracking-display">Admin</h1>
      {/* the session is read per request, so it streams in behind the static shell */}
      <Suspense fallback={<p className="text-sm text-muted">Checking sign-in…</p>}>
        <AdminPanel />
      </Suspense>
    </main>
  )
}

async function AdminPanel() {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')

  // read fresh as the signed-in user, not through the chart's cached getEvents()
  const { data, error } = await (await authClient())
    .from('annotations')
    .select('id, date, end_date, label, mode_group, detail')
    .order('date')
    .order('id')
  if (error) throw new Error(`annotations: ${error.message}`)

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="text-muted">
          Signed in as <span className="font-medium text-foreground">{admin.email}</span>
        </p>
        <form action={signOut}>
          <button type="submit" className="underline underline-offset-2">Sign out</button>
        </form>
        <Link href="/" className="underline underline-offset-2">View chart</Link>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">Annotations</h2>
        <AnnotationsTable rows={data satisfies Annotation[]} />
      </section>
    </>
  )
}
