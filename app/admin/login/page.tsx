import type { Metadata } from 'next'
import LoginForm from './login-form'

export const metadata: Metadata = { title: 'Admin sign in · MBTA Ridership', robots: { index: false } }

// Static: there's no sign-up, so the only account is the admin created in the Supabase dashboard
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <LoginForm />
    </main>
  )
}
