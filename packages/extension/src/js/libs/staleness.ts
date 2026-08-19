// Pure staleness classification for the Notion tab-archive feature.
// Shared by the popup UI (StaleTabsStore) and the MV3 service worker
// (NotionArchiver) — keep this module free of browser/store imports.
//
// Specs: openspec/specs/stale-tab-detection/spec.md

import { extractSuspendedInfo, isDomainExcluded } from './suspendedTabs'

/** Minimal structural tab shape — satisfied by both raw `chrome.tabs.Tab`
 * objects (background) and `stores/Tab` instances (popup). */
export interface StalenessTab {
  id?: number
  url?: string
  pinned?: boolean
  active?: boolean
  audible?: boolean
  status?: string
  title?: string
  /** Chrome tab-group membership; `TAB_GROUP_ID_NONE` (-1) when ungrouped. */
  groupId?: number
  /** Chromium ≥121 native last-activity timestamp (ms since epoch). */
  lastAccessed?: number
}

export interface StaleTabsOptions {
  /** Idle duration beyond which a tab counts as stale (ms). */
  thresholdMs: number
  /** Current time (ms since epoch) — injected for purity/testability. */
  now: number
  /** URLs archived within the dedup window (see `recentJournalUrls`). */
  journalUrls?: ReadonlySet<string>
  /** Exclude pinned tabs from candidacy. Defaults to true. */
  excludePinnedTabs?: boolean
  /** Exclude tabs belonging to a Chrome tab group. Defaults to true. */
  excludeGroupedTabs?: boolean
  /** Recover the real URL behind a suspender placeholder. Defaults to true. */
  extractSuspendedTabUrl?: boolean
  /** Hostnames that are never archived (see `parseExcludedDomains`). */
  excludedDomains?: readonly string[]
}

/** A tab's effective identity once a suspender placeholder is unwrapped. */
export interface ResolvedTab {
  url: string
  title: string | null
  /** True when url/title came from a placeholder rather than the tab itself. */
  recovered: boolean
}

/**
 * The single place that decides what a tab "really is". Every URL-dependent
 * decision — eligibility, domain exclusion, dedup, and what gets archived —
 * must go through this so the answer cannot diverge between them.
 */
export function resolveTab(
  tab: StalenessTab,
  extractSuspended = true,
): ResolvedTab {
  const raw = tab.url || ''
  if (extractSuspended) {
    const recovered = extractSuspendedInfo(raw)
    if (recovered) {
      return {
        url: recovered.url,
        title: recovered.title,
        recovered: true,
      }
    }
  }
  return { url: raw, title: null, recovered: false }
}

/** `chrome.tabGroups.TAB_GROUP_ID_NONE` — the "ungrouped" sentinel. */
export const TAB_GROUP_ID_NONE = -1

/** Journal dedup window: URLs archived within this window are not re-proposed. */
export const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const HTTP_SCHEME = /^https?:\/\//i

/**
 * True when the tab is idle beyond the threshold and not excluded.
 *
 * Always excluded (manual and auto mode alike): the active tab of each window,
 * audible tabs, non-http(s) URLs, tabs still loading or with an empty URL, URLs
 * in `journalUrls` (archived recently), and tabs with a missing `lastAccessed`
 * (conservative — never archive on missing data).
 *
 * Excluded by setting: pinned tabs (`excludePinnedTabs`), tab-group members
 * (`excludeGroupedTabs`) — both default on — and any hostname in
 * `excludedDomains`. URLs are evaluated after suspender-placeholder
 * resolution (`extractSuspendedTabUrl`, default on).
 */
export function isStaleTab(
  tab: StalenessTab,
  options: StaleTabsOptions,
): boolean {
  const {
    thresholdMs,
    now,
    journalUrls,
    excludePinnedTabs = true,
    excludeGroupedTabs = true,
    extractSuspendedTabUrl = true,
    excludedDomains,
  } = options
  if (tab.active || tab.audible) {
    return false
  }
  if (excludePinnedTabs && tab.pinned) {
    return false
  }
  if (
    excludeGroupedTabs &&
    typeof tab.groupId === 'number' &&
    tab.groupId !== TAB_GROUP_ID_NONE
  ) {
    return false
  }
  if (tab.status === 'loading') {
    return false
  }
  // Evaluate the RESOLVED url so a parked tab is judged as its real page.
  const { url } = resolveTab(tab, extractSuspendedTabUrl)
  if (!url || !HTTP_SCHEME.test(url)) {
    return false
  }
  if (isDomainExcluded(url, excludedDomains || [])) {
    return false
  }
  if (journalUrls && journalUrls.has(url)) {
    return false
  }
  if (typeof tab.lastAccessed !== 'number') {
    return false
  }
  return now - tab.lastAccessed > thresholdMs
}

/** Filter `tabs` down to the stale, archive-eligible ones (input order kept). */
export function getStaleTabs<T extends StalenessTab>(
  tabs: readonly T[],
  options: StaleTabsOptions,
): T[] {
  return tabs.filter((tab) => isStaleTab(tab, options))
}

/**
 * URLs from journal entries within the dedup window (default 7 days).
 * Pass the result as `journalUrls` to `getStaleTabs`.
 */
export function recentJournalUrls(
  entries: ReadonlyArray<{ url: string; archivedAt: number }>,
  now: number,
  windowMs: number = DEDUP_WINDOW_MS,
): Set<string> {
  const urls = new Set<string>()
  for (const entry of entries) {
    if (now - entry.archivedAt <= windowMs) {
      urls.add(entry.url)
    }
  }
  return urls
}
