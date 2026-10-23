// Annotation rows as the admin table reads and writes them, and validation for its forms.
// Mirrors the table's constraints so errors show before a round trip to the database, except that
// modes are limited to the charted ones (the table also allows Ferry).

import { MODES } from './modes'

export type Annotation = {
  id: number
  date: string // YYYY-MM-DD
  end_date: string | null
  label: string
  mode_group: string | null // null = all modes
  detail: string | null
}
export type AnnotationInput = Omit<Annotation, 'id'>

export const LABEL_MAX = 40

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (d: string) => ISO_DATE.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().startsWith(d)
const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim()

export function parseAnnotation(form: FormData): { data: AnnotationInput } | { error: string } {
  const date = field(form, 'date')
  const end_date = field(form, 'end_date') || null
  const label = field(form, 'label')
  const mode_group = field(form, 'mode_group') || null
  const detail = field(form, 'detail') || null

  if (!isDate(date)) return { error: 'Enter a valid date.' }
  if (end_date && !isDate(end_date)) return { error: 'Enter a valid end date, or leave it empty.' }
  if (end_date && end_date <= date) return { error: 'The end date must be after the date.' }
  if (!label) return { error: 'Enter a label.' }
  if (label.length > LABEL_MAX) return { error: `Keep the label to ${LABEL_MAX} characters; put the rest in the detail.` }
  if (mode_group && !(MODES as readonly string[]).includes(mode_group)) return { error: 'Pick a mode.' }
  return { data: { date, end_date, label, mode_group, detail } }
}
