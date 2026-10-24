'use client'

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import { LABEL_MAX, type Annotation } from '@/lib/annotation-form'
import { MODES } from '@/lib/modes'
import { deleteAnnotation, saveAnnotation, type AnnotationState } from './actions'

// Form fields as strings, in controlled inputs. The row forms submit through onSubmit rather than
// `action`, because React resets a form after its action runs, and that reset also blanks a
// controlled <select>, so a failed save would lose the chosen mode.
// Pending buttons are aria-disabled rather than disabled: disabling the focused button would drop
// keyboard focus to <body>. Swapping a row between view and edit moves focus to match.
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
  'w-full border-2 border-foreground bg-background outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background px-2 py-1'
const button = 'px-2 py-1 font-bold aria-disabled:opacity-50'
const primary = `${button} bg-band text-band-ink`
const quiet = `${button} underline-offset-2 hover:underline`

const isError = (s: AnnotationState): s is { error: string } => !!s && 'error' in s

// FormData includes the inputs joined to the form through their `form` attribute
const submitTo = (action: (form: FormData) => void, pending: boolean) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (pending) return
  const form = new FormData(e.currentTarget)
  startTransition(() => action(form))
}

export default function AnnotationsTable({ rows }: { rows: Annotation[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <th className={`${cell} w-36 font-bold`}>Date</th>
            <th className={`${cell} w-36 font-bold`}>End date</th>
            <th className={`${cell} w-44 font-bold`}>Label</th>
            <th className={`${cell} w-32 font-bold`}>Mode</th>
            <th className={`${cell} font-bold`}>Detail</th>
            <th className={`${cell} w-36`}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => <AnnotationRow key={row.id} row={row} />)}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className={`${cell} text-muted`}>No annotations yet.</td>
            </tr>
          )}
        </tbody>
        <tfoot className="border-t-2 border-foreground bg-panel">
          <AddRow />
        </tfoot>
      </table>
    </div>
  )
}

function AnnotationRow({ row }: { row: Annotation }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const formId = `annotation-${row.id}`
  const errorId = useId()
  const editButton = useRef<HTMLButtonElement>(null)
  // back on the Edit button once the row leaves edit mode (Save or Cancel removed the focused button)
  const refocusEdit = useRef(false)
  const closeDraft = () => {
    refocusEdit.current = true
    setDraft(null)
  }
  useEffect(() => {
    if (draft || !refocusEdit.current) return
    refocusEdit.current = false
    editButton.current?.focus()
  }, [draft])

  const [saveState, save, saving] = useActionState(async (prev: AnnotationState, form: FormData) => {
    const result = await saveAnnotation(prev, form)
    if (!isError(result)) closeDraft()
    return result
  }, undefined)
  const [deleteState, remove, deleting] = useActionState(deleteAnnotation, undefined)

  const confirmDelete = (e: FormEvent) => {
    if (deleting || !confirm(`Delete “${row.label}”? This can't be undone.`)) e.preventDefault()
  }

  const error = (draft && isError(saveState) && saveState.error) || (isError(deleteState) && deleteState.error)
  const describedBy = error ? errorId : undefined

  return (
    <>
      <tr className={`border-b border-rule ${deleting ? 'opacity-50' : ''}`}>
        {draft ? (
          <DraftCells draft={draft} setDraft={setDraft} formId={formId} describedBy={describedBy} autoFocus />
        ) : (
          <>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{show(row.date)}</td>
            <td className={`${cell} whitespace-nowrap tabular-nums`}>{row.end_date ? show(row.end_date) : <Muted>—</Muted>}</td>
            <td className={`${cell} font-bold`}>{row.label}</td>
            <td className={cell}>{row.mode_group ?? <Muted>All modes</Muted>}</td>
            <td className={`${cell} text-muted`}>{row.detail ?? <Muted>—</Muted>}</td>
          </>
        )}
        <td className={`${cell} whitespace-nowrap text-right`}>
          {draft ? (
            <form id={formId} onSubmit={submitTo(save, saving)} className="inline-flex gap-1">
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" aria-disabled={saving} aria-describedby={describedBy} className={primary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" aria-disabled={saving} onClick={() => !saving && closeDraft()} className={quiet}>
                Cancel
              </button>
            </form>
          ) : (
            <div className="inline-flex gap-1">
              <button type="button" ref={editButton} onClick={() => setDraft(toDraft(row))} className={quiet} aria-label={`Edit ${row.label}`}>
                Edit
              </button>
              <form action={remove} onSubmit={confirmDelete}>
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  aria-disabled={deleting}
                  aria-describedby={describedBy}
                  className={`${quiet} text-danger`}
                  aria-label={`Delete ${row.label}`}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </form>
            </div>
          )}
        </td>
      </tr>
      {error && <ErrorRow id={errorId} message={error} />}
    </>
  )
}

function AddRow() {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const errorId = useId()
  // after an add, back to the empty Date field for the next one
  const dateInput = useRef<HTMLInputElement>(null)
  const [state, add, adding] = useActionState(async (prev: AnnotationState, form: FormData) => {
    const result = await saveAnnotation(prev, form)
    if (!isError(result)) {
      setDraft(EMPTY)
      dateInput.current?.focus()
    }
    return result
  }, undefined)
  const describedBy = isError(state) ? errorId : undefined

  return (
    <>
      <tr>
        <DraftCells draft={draft} setDraft={setDraft} formId="annotation-new" describedBy={describedBy} firstRef={dateInput} />
        <td className={`${cell} text-right`}>
          <form id="annotation-new" onSubmit={submitTo(add, adding)}>
            <button type="submit" aria-disabled={adding} aria-describedby={describedBy} className={primary}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </form>
        </td>
      </tr>
      {isError(state) && <ErrorRow id={errorId} message={state.error} />}
    </>
  )
}

// Inputs for one row; they sit in table cells, so they join the row's form through `form`.
// A row's error isn't tied to one field, so every input is described by it.
function DraftCells({
  draft,
  setDraft,
  formId,
  describedBy,
  autoFocus,
  firstRef,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  formId: string
  describedBy?: string
  autoFocus?: boolean
  firstRef?: Ref<HTMLInputElement>
}) {
  const bind = (name: keyof Draft) => ({
    name,
    form: formId,
    value: draft[name],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [name]: e.target.value }),
    'aria-describedby': describedBy,
    className: input,
  })
  return (
    <>
      <td className={cell}><input type="date" required aria-label="Date" autoFocus={autoFocus} ref={firstRef} {...bind('date')} /></td>
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

function ErrorRow({ id, message }: { id: string; message: string }) {
  return (
    <tr>
      <td colSpan={6} className="px-2 pb-2 text-sm text-danger">
        <span id={id} role="alert">{message}</span>
      </td>
    </tr>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted">{children}</span>
}
