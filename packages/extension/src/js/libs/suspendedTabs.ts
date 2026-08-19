// URL handling for the Notion tab-archive feature: recovering the real page
// behind a suspender extension's placeholder, and hostname-based exclusion.
//
// Pure module — no browser/store imports, shared by the popup and the SW.
// Specs: openspec/specs/{stale-tab-detection,tab-archiving}/spec.md

const HTTP_SCHEME = /^https?:\/\//i
const EXTENSION_SCHEME = /^(chrome|moz)-extension:\/\//i

/** Parameter names suspenders commonly use for the original URL/title. */
const URL_PARAM_NAMES = ['url', 'uri', 'u']
const TITLE_PARAM_NAMES = ['title', 'ttl']

export interface SuspendedInfo {
  url: string
  title: string | null
}

/**
 * Collect query-string AND hash parameters. Both are needed: Tab Suspender
 * parks as `park.html?url=…` while The Great Suspender and its forks use
 * `suspended.html#uri=…`.
 */
const collectParams = (raw: string): Array<[string, string]> => {
  const pairs: Array<[string, string]> = []
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return pairs
  }
  parsed.searchParams.forEach((value, key) => pairs.push([key, value]))
  const hash = parsed.hash.replace(/^#/, '')
  if (hash) {
    // The hash may itself be `key=value&key=value`.
    for (const part of hash.split('&')) {
      const index = part.indexOf('=')
      if (index <= 0) {
        continue
      }
      const key = part.slice(0, index)
      let value = part.slice(index + 1)
      try {
        value = decodeURIComponent(value)
      } catch {
        // keep the raw value
      }
      pairs.push([key, value])
    }
  }
  return pairs
}

/**
 * Recover the real page behind an extension placeholder URL.
 * Returns null when `raw` is not a placeholder, or carries no http(s) URL.
 *
 * Deliberately generic (any extension placeholder with a URL-valued
 * parameter) rather than matching a specific extension id — see design.md.
 */
export const extractSuspendedInfo = (
  raw: string | undefined,
): SuspendedInfo | null => {
  const value = raw || ''
  if (!value || !EXTENSION_SCHEME.test(value)) {
    return null
  }
  const pairs = collectParams(value)
  if (!pairs.length) {
    return null
  }
  const isUrl = (candidate: string) => HTTP_SCHEME.test(candidate)
  // Prefer a conventionally-named parameter, then any URL-valued one.
  let url: string | null = null
  for (const name of URL_PARAM_NAMES) {
    const hit = pairs.find(
      ([key, entry]) => key.toLowerCase() === name && isUrl(entry),
    )
    if (hit) {
      url = hit[1]
      break
    }
  }
  if (!url) {
    const hit = pairs.find(([, entry]) => isUrl(entry))
    url = hit ? hit[1] : null
  }
  if (!url) {
    return null
  }
  const titleHit = pairs.find(
    ([key, entry]) =>
      TITLE_PARAM_NAMES.includes(key.toLowerCase()) && entry.trim() !== '',
  )
  return { url, title: titleHit ? titleHit[1] : null }
}

/**
 * Reduce a user-typed entry to a bare hostname: accepts a full URL, a
 * host with a port, or a bare domain, and drops a leading `www.`.
 * Returns '' when nothing usable remains.
 */
export const normalizeDomainEntry = (entry: string): string => {
  let value = (entry || '').trim().toLowerCase()
  if (!value) {
    return ''
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) {
    value = `http://${value}`
  }
  let host = ''
  try {
    host = new URL(value).hostname
  } catch {
    return ''
  }
  return host.replace(/^www\./, '')
}

/** Parse the newline-separated settings field into normalized hostnames. */
export const parseExcludedDomains = (text: string): string[] => {
  if (!text) {
    return []
  }
  const domains: string[] = []
  for (const line of text.split(/[\n,]/)) {
    const host = normalizeDomainEntry(line)
    if (host && !domains.includes(host)) {
      domains.push(host)
    }
  }
  return domains
}

/**
 * True when `url`'s hostname equals a listed domain or is a subdomain of one.
 * Matching is on label boundaries, so `notion.com` does NOT match
 * `notionary.example.com`.
 */
export const isDomainExcluded = (
  url: string | undefined,
  domains: readonly string[],
): boolean => {
  if (!domains || !domains.length || !url) {
    return false
  }
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return false
  }
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  )
}
