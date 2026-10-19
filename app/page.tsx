import { getMonthlyRidership } from '@/lib/ridership'
import RidershipSummary from './ridership-summary'

export default async function Home() {
  const rows = await getMonthlyRidership()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">MBTA ridership</h1>
      <RidershipSummary rows={rows} />
    </main>
  )
}
