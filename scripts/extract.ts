// scripts/extract.ts (bun scripts/extract.ts [path/to/file.xlsx])
import * as XLSX from 'xlsx'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Use the path given on the command line, else the most recently modified .xlsx in data/raw
const RAW = 'data/raw'
const latestXlsx = () => {
  const files = readdirSync(RAW).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$')).map(f => join(RAW, f))
  if (!files.length) throw new Error(`no .xlsx files in ${RAW}`)
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}
const file = process.argv[2] ?? latestXlsx()
console.log('reading', file)
const wb = XLSX.readFile(file)
const ws = wb.Sheets['UPT']; if (!ws) throw new Error(`tabs: ${wb.SheetNames}`)
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true })
const head = rows[0].map(String)
const col = (n: string) => { const i = head.indexOf(n); if (i < 0) throw new Error(`no "${n}" in ${head.slice(0, 15)}`); return i }
const [ID, MODE, TOS] = [col('NTD ID'), col('Mode'), col('TOS')]

const toMonth = (h: unknown): string | null => {
  if (typeof h === 'number') { const d = XLSX.SSF.parse_date_code(h); return `${d.y}-${String(d.m).padStart(2,'0')}-01` }
  const m = String(h).match(/^(\d{1,2})\/(\d{4})$/)
  return m ? `${m[2]}-${m[1].padStart(2,'0')}-01` : null
}
const monthCols = rows[0].map((h, i) => [i, toMonth(h)] as const).filter(([, m]) => m)

const out = ['mode,tos,month,trips']
for (const r of rows.slice(1)) {
  if (String(r[ID]) !== '10003') continue
  for (const [i, month] of monthCols) {
    const v = r[i]; if (v === undefined || v === '') continue
    out.push(`${r[MODE]},${r[TOS]},${month},${Number(String(v).replace(/,/g, ''))}`)
  }
}
await Bun.write('data/ridership.csv', out.join('\n') + '\n')
console.log(out.length - 1, 'rows')