'use client'

import { useActionState } from 'react'
import { signIn } from '../actions'

const input =
  'rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-series-1)] dark:border-white/15'

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input name="email" type="email" autoComplete="username" required defaultValue={state?.email} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--foreground)] px-3 py-2 text-sm font-medium text-[var(--background)] disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
