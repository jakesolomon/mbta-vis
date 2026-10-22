'use server'

import { redirect } from 'next/navigation'
import { authClient } from '@/lib/auth'

export type SignInState = { error: string; email: string } | undefined

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.', email }

  const { error } = await (await authClient()).auth.signInWithPassword({ email, password })
  if (error) {
    // don't say which of the two was wrong
    const message = error.code === 'invalid_credentials' ? 'Wrong email or password.' : error.message
    return { error: message, email }
  }
  redirect('/admin')
}

export async function signOut() {
  await (await authClient()).auth.signOut()
  redirect('/admin/login')
}
