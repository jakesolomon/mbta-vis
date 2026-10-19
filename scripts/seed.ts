// scripts/seed.ts (bun scripts/seed.ts [path/to/ridership.csv])
// Replaces the contents of ridership_raw with the CSV written by scripts/extract.ts.
import { SQL } from 'bun'

// SUPABASE_DB_URL if set (e.g. a local db), else the linked project's pooler URL + SUPABASE_DB_PASSWORD from .env.local
const dbUrl = async () => {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) throw new Error('set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD')
  const pooler = Bun.file('supabase/.temp/pooler-url')
  if (!(await pooler.exists())) throw new Error('no supabase/.temp/pooler-url: run `bunx supabase link` or set SUPABASE_DB_URL')
  const url = new URL((await pooler.text()).trim())
  url.password = password
  return url.toString()
}

const file = process.argv[2] ?? 'data/ridership.csv'
const [head, ...lines] = (await Bun.file(file).text()).trim().split('\n')
if (head !== 'mode,tos,month,trips') throw new Error(`unexpected header in ${file}: ${head}`)
const rows = lines.map(l => {
  const [mode, tos, month, trips] = l.split(',')
  return { mode, tos, month, trips: Number(trips) }
})

const sql = new SQL(await dbUrl())
const CHUNK = 1000
await sql.begin(async tx => {
  await tx`delete from ridership_raw`
  for (let i = 0; i < rows.length; i += CHUNK)
    await tx`insert into ridership_raw ${tx(rows.slice(i, i + CHUNK))}`
})
await sql.close()
console.log('seeded', rows.length, 'rows from', file)
