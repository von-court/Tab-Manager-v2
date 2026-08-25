// The one "never archive this" rule, shared by every archive path
// (spec: tab-archiving).

import { archiveRefusal } from 'libs/staleness'

describe('archiveRefusal', () => {
  it('accepts http and https pages', () => {
    expect(archiveRefusal('https://example.com/a')).toBeNull()
    expect(archiveRefusal('http://example.com/a')).toBeNull()
    expect(archiveRefusal('HTTPS://Example.com/a')).toBeNull()
  })

  it('refuses everything that is not http(s)', () => {
    expect(archiveRefusal('chrome://extensions')).toBe('not-http')
    expect(archiveRefusal('about:blank')).toBe('not-http')
    expect(archiveRefusal('file:///tmp/a.html')).toBe('not-http')
    expect(archiveRefusal('')).toBe('not-http')
    expect(archiveRefusal(undefined)).toBe('not-http')
  })

  it('refuses excluded domains and their subdomains', () => {
    const domains = ['notion.com']
    expect(archiveRefusal('https://notion.com/page', domains)).toBe(
      'excluded-domain',
    )
    expect(archiveRefusal('https://app.notion.com/page', domains)).toBe(
      'excluded-domain',
    )
    expect(archiveRefusal('https://www.notion.com/page', domains)).toBe(
      'excluded-domain',
    )
  })

  it('does not refuse a domain that merely shares a prefix', () => {
    expect(
      archiveRefusal('https://notionary.example.com/a', ['notion.com']),
    ).toBeNull()
  })

  it('treats an empty exclusion list as no exclusions', () => {
    expect(archiveRefusal('https://example.com/a', [])).toBeNull()
    expect(archiveRefusal('https://example.com/a')).toBeNull()
  })

  it('reports the scheme refusal before the domain one', () => {
    expect(archiveRefusal('chrome://notion.com', ['notion.com'])).toBe(
      'not-http',
    )
  })
})
