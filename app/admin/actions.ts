'use server'

import { refresh, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { parseAnnotation } from '@/lib/annotation-form'
import { authClient } from '@/lib/auth'

export type SignInState = { error: string; email: string } | undefined

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.', email }

  const { error } = await (await authClient()).auth.signInWithPassword({ email, password })
  if (error) {
    // Don't say which of the two was wrong, or pass on other errors (e.g. "Email not confirmed"
    // would confirm the account exists)
    if (error.code === 'invalid_credentials') return { error: 'Wrong email or password.', email }
    if (error.code === 'over_request_rate_limit')
      return { error: 'Too many attempts. Try again in a few minutes.', email }
    console.error('signIn:', error.code, error.message)
    return { error: "Couldn't sign in. Try again.", email }
  }
  redirect('/admin')
}

export async function signOut() {
  await (await authClient()).auth.signOut()
  redirect('/admin/login')
}

// Annotation edits. RLS is what actually stops anyone else (writes need an authenticated user);
// the session check here just gives a clearer message than a policy violation.
// `saved` changes on every success, so a form can tell a new save from the last one.
export type AnnotationState = { error: string } | { saved: number } | undefined

async function signedInClient() {
  const supabase = await authClient()
  const { data } = await supabase.auth.getClaims()
  return data ? supabase : null
}

// Expire the chart's cached annotations and re-render the admin table with fresh rows
function afterWrite(): AnnotationState {
  updateTag('annotations')
  refresh()
  return { saved: Date.now() }
}

// Inserts when the form has no id, otherwise updates that row
export async function saveAnnotation(_prev: AnnotationState, formData: FormData): Promise<AnnotationState> {
  const parsed = parseAnnotation(formData)
  if ('error' in parsed) return parsed
  const supabase = await signedInClient()
  if (!supabase) return { error: 'Your session has expired. Sign in again.' }

  const id = Number(formData.get('id')) || null
  const { data, error } = id
    ? await supabase.from('annotations').update(parsed.data).eq('id', id).select('id')
    : await supabase.from('annotations').insert(parsed.data).select('id')
  if (error) return { error: `Couldn't save: ${error.message}` }
  if (!data.length) return { error: 'That annotation no longer exists. Reload the page.' }
  return afterWrite()
}

export async function deleteAnnotation(_prev: AnnotationState, formData: FormData): Promise<AnnotationState> {
  const id = Number(formData.get('id'))
  if (!id) return { error: 'Missing annotation id.' }
  const supabase = await signedInClient()
  if (!supabase) return { error: 'Your session has expired. Sign in again.' }

  const { error } = await supabase.from('annotations').delete().eq('id', id)
  if (error) return { error: `Couldn't delete: ${error.message}` }
  return afterWrite()
}
