import { getEvents } from '@/lib/events'
import { MODES } from '@/lib/modes'
import { getMonthlyRidership, indexTo2019Average } from '@/lib/ridership'
import RidershipChart from './ridership-chart'

export default async function Home() {
  const [rows, events] = await Promise.all([getMonthlyRidership('2019-01-01'), getEvents()])
  const series = MODES.map(name => ({ name, points: indexTo2019Average(rows, name) }))

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">MBTA ridership</h1>
      <RidershipChart title="Ridership recovery by mode" series={series} events={events} />
    </main>
  )
}
