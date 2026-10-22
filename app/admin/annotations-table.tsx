'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { LABEL_MAX, type Annotation } from '@/lib/annotation-form'
import { MODES } from '@/lib/modes'
import { deleteAnnotation, saveAnnotation, type AnnotationState } from './actions'

// Form fields as strings, in controlled inputs. The row forms submit through onSubmit rather than
// `action`, because React resets a form after its action runs, and that reset also blanks a
// controlled <select>, so a failed save would lose the chosen mode.
type Draft = { date: string; end_date: string; label: string; mode_group: string; detail: string }
const EMPTY: Draft = { date: '', end_date: '', label: '', mode_group: '', detail: '' }
const toDraft = (a: Annotation): Draft => ({
  date: a.date,
  end_date: a.end_date ?? '',
  label: a.label,
  mode_group: a.mode_group ?? '',
  detail: a.detail ?? '',
})

const fmtDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const show = (d: string) => fmtDate.format(new Date(d))

const cell = 'px-2 py-2 align-top'
const input =
  'w-full rounded border border-black/15 bg-transparent px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-series-1)] dark:border-white/15'
const button = 'rounded px-2 py-1 font-medium disabled:opacity-50'
const primary = `${button} bg-[var(--foreground)] text-[var(--background)]`
const quiet = `${button} underline-offset-2 hover:underline`

const isError = (s: AnnotationState): s is { error: string } => !!s && 'error' in s

// FormData includes the inputs joined to the form through their `form` attribute
const submitTo = (action: (form: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const form = new FormData(e.currentTarget)
  startTransition(() => action(form))
}

export default function AnnotationsTable({ rows }: { rows: Annotation[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-zinc-600 dark:border-white/10 dark:text-zinc-400">
            <th className={`${cell} w-36 font-medium`}>Date</th>
            <th className={`${cell} w-36 font-medium`}>End date</th>
            <th className={`${cell} w-44 font-medium`}>Label</th>
            <th className={`${cell} w-32 font-medium`}>Mode</th>
            <th className={`${cell} font-medium`}>Detail</th>
            <th className={`${cell} w-36`}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => <AnnotationRow key={row.id} row={row} />)}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className={`${cell} text-zinc-600 dark:text-zinc-400`}>No annotations yet.</td>
            </tr>
          )}
        </tbody>
        <tfoot className="border-t border-black/10 dark:border-white/10">
          <AddRow />
        </tfoot>
      </table>
    </div>
  )
}

function AnnotationRow({ row }: { row: Annotation }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const formId = `annotation-${row.id}`

  const [saveState, save, saving] = useActionState(async (prev: AnnotationState, form: FormData) => {
    const result = await saveAnnotation(prev, form)
    if (!isError(result)) setDraft(null)
    return result
  }, undefined)
  const [deleteState, remove, deleting] = useActionState(deleteAnnotation, undefined)

  const confirmDelete = (e: FormEvent) => {
    if (!confirm(`Delete “${row.label}”? This can't be undone.`)) e.preventDefault()
  }

  const error = (draft && isError(saveState) && saveState.error) || (isError(deleteState) && deleteState.error)

  return (
    <>
      <tr className={`border-b border-black/5 dark:border-white/5 ${deleting ? 'opacity-50' : ''}`}>
        {draft ? (
          <DraftCells draft={draft} setDraft={setDraft} formId={formId} />
        ) : (
          <>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{show(row.date)}</td>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{row.end_date ? show(row.end_date) : <Muted>—</Muted>}</td>
            <td className={`${cell} font-medium`}>{row.label}</td>
            <td className={cell}>{row.mode_group ?? <Muted>All modes</Muted>}</td>
            <td className={`${cell} text-[var(--chart-ink-secondary)]`}>{row.detail ?? <Muted>—</Muted>}</td>
          </>
        )}
        <td className={`${cell} whitespace-nowrap text-right`}>
          {draft ? (
            <form id={formId} onSubmit={submitTo(save)} className="inline-flex gap-1">
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" disabled={saving} className={primary}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" disabled={saving} onClick={() => setDraft(null)} className={quiet}>Cancel</button>
            </form>
          ) : (
            <div className="inline-flex gap-1">
              <button type="button" onClick={() => setDraft(toDraft(row))} className={quiet} aria-label={`Edit ${row.label}`}>
                Edit
              </button>
              <form action={remove} onSubmit={confirmDelete}>
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" disabled={deleting} className={`${quiet} text-red-600 dark:text-red-400`} aria-label={`Delete ${row.label}`}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </form>
            </div>
          )}
        </td>
      </tr>
      {error && <ErrorRow message={error} />}
    </>
  )
}

function AddRow() {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [state, add, adding] = useActionState(async (prev: AnnotationState, form: FormData) => {
    const result = await saveAnnotation(prev, form)
    if (!isError(result)) setDraft(EMPTY)
    return result
  }, undefined)

  return (
    <>
      <tr>
        <DraftCells draft={draft} setDraft={setDraft} formId="annotation-new" />
        <td className={`${cell} text-right`}>
          <form id="annotation-new" onSubmit={submitTo(add)}>
            <button type="submit" disabled={adding} className={primary}>{adding ? 'Adding…' : 'Add'}</button>
          </form>
        </td>
      </tr>
      {isError(state) && <ErrorRow message={state.error} />}
    </>
  )
}

// Inputs for one row; they sit in table cells, so they join the row's form through `form`
function DraftCells({ draft, setDraft, formId }: { draft: Draft; setDraft: (d: Draft) => void; formId: string }) {
  const bind = (name: keyof Draft) => ({
    name,
    form: formId,
    value: draft[name],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [name]: e.target.value }),
    className: input,
  })
  return (
    <>
      <td className={cell}><input type="date" required aria-label="Date" {...bind('date')} /></td>
      <td className={cell}><input type="date" min={draft.date || undefined} aria-label="End date (optional)" {...bind('end_date')} /></td>
      <td className={cell}><input type="text" required maxLength={LABEL_MAX} placeholder="Label" aria-label="Label" {...bind('label')} /></td>
      <td className={cell}>
        <select aria-label="Mode" {...bind('mode_group')}>
          <option value="">All modes</option>
          {MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td className={cell}><input type="text" placeholder="Detail (optional)" aria-label="Detail" {...bind('detail')} /></td>
    </>
  )
}

function ErrorRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} role="alert" className="px-2 pb-2 text-sm text-red-600 dark:text-red-400">{message}</td>
    </tr>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--chart-muted)]">{children}</span>
}
