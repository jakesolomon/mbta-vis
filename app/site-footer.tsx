import { REPO_URL } from '@/lib/site'
import ExternalLink from './external-link'

const STACK = ['Next.js 16', 'Supabase', 'visx', 'Tailwind CSS', 'Bun']

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro uppercase tracking-eyebrow text-band-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-band text-band-ink">
      <dl className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-3 px-4 py-6 text-caption leading-relaxed sm:px-7">
        <Item label="Data">
          <ExternalLink href="https://www.transit.dot.gov/ntd" className="underline underline-offset-4">
            FTA National Transit Database
          </ExternalLink>
          , monthly ridership
        </Item>
        <Item label="Built with">{STACK.join(' · ')}</Item>
        <Item label="Code">
          <ExternalLink href={REPO_URL} className="underline underline-offset-4">github.com/jakesolomon/mbta-vis</ExternalLink>
        </Item>
        <Item label="By">Jake Solomon · not affiliated with the MBTA</Item>
      </dl>
    </footer>
  )
}
