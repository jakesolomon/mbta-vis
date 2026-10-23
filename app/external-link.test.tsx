import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ExternalLink from './external-link'

const html = renderToStaticMarkup(
  <ExternalLink href="https://example.com/repo" className="underline">Repo</ExternalLink>,
)

test('links to the href with the given class', () => {
  expect(html).toStartWith('<a href="https://example.com/repo" class="underline">Repo')
})

test('marks the link as external, visually and for screen readers', () => {
  expect(html).toContain('<svg aria-hidden="true"')
  expect(html).toContain('<span class="sr-only"> (external site)</span>')
})

test('opens in the same tab', () => {
  expect(html).not.toContain('target=')
})
