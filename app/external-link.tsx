// A link that leaves the site: marked with an arrow (and said so to screen readers) so it can't be
// mistaken for site navigation. It opens in the same tab, like any other link.
export default function ExternalLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a href={href} className={className}>
      {children}
      <svg aria-hidden="true" viewBox="0 0 10 10" className="ml-1 inline-block size-2.5 align-baseline">
        <path d="M3 1.5h5.5V7M8.5 1.5 1.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="sr-only"> (external site)</span>
    </a>
  )
}
