'use client'

import { useActionState } from 'react'
import { signIn } from '../actions'

const input =
  'border-2 border-foreground bg-background outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background px-3 py-2'

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Email
        <input name="email" type="email" autoComplete="username" required defaultValue={state?.email} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-band px-3 py-2.5 text-sm font-bold text-band-ink disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
