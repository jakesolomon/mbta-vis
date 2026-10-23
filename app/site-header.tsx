import Link from 'next/link'
import { REPO_URL } from '@/lib/site'
import ExternalLink from './external-link'

const link = 'text-band-muted underline-offset-4 hover:text-band-ink hover:underline'
// the three line colors, in MODES order (full class names so Tailwind generates them)
const LINES = ['bg-chart-series-1', 'bg-chart-series-2', 'bg-chart-series-3']

// Black sign band with the three line colors as the mark, then a strip of the same colors.
// Static (no session check), so it doesn't stop pages from prerendering; /admin redirects to sign in.
export default function SiteHeader() {
  return (
    <header>
      <div className="bg-band text-band-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-7">
          <Link href="/" className="flex items-center gap-2.5 text-wordmark font-extrabold tracking-wordmark">
            <span aria-hidden="true" className="grid grid-cols-3 gap-0.75">
              {LINES.map(bg => <span key={bg} className={`block h-4.5 w-1.5 ${bg}`} />)}
            </span>
            MBTA Ridership Recovery
          </Link>
          {/* site pages in the nav; the repo sits apart, after a divider, marked as leaving the site */}
          <div className="flex items-center gap-4 text-caption font-medium sm:gap-5">
            <nav aria-label="Site" className="flex gap-4 sm:gap-5">
              <Link href="/#how" className={`${link} hidden sm:inline`}>How it&apos;s built</Link>
              <Link href="/admin" className={link}>Admin</Link>
            </nav>
            <ExternalLink href={REPO_URL} className={`${link} border-l border-band-muted pl-4 sm:pl-5`}>
              GitHub
            </ExternalLink>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="grid h-1.5 grid-cols-3">
        {LINES.map(bg => <span key={bg} className={bg} />)}
      </div>
    </header>
  )
}
