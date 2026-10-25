'use client'

import { useActionState, useEffect } from 'react'
import { signIn } from '../actions'

const input =
  'border-2 border-foreground bg-background outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background px-3 py-2'

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined)
  const signedIn = state !== undefined && 'signedIn' in state
  const error = state !== undefined && 'error' in state ? state : undefined

  // A full page load, so /admin renders with the new session cookie rather than from the
  // router's signed-out prefetch (see signIn)
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a client navigation is what goes wrong
    if (signedIn) window.location.assign('/admin')
  }, [signedIn])

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Email
        <input name="email" type="email" autoComplete="username" required defaultValue={error?.email} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || signedIn}
        className="bg-action px-3 py-2.5 text-sm font-bold text-action-ink enabled:hover:bg-action-hover disabled:opacity-60"
      >
        {pending || signedIn ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
