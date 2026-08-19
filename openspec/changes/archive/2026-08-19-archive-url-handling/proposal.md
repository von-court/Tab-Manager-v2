# Proposal: archive-url-handling

## Why

Two gaps make archiving miss or misfire on real browsing.

Some sites should never be archived — Notion itself being the obvious one. Archiving
`app.notion.com` into Notion is noise at best, and there is currently no way to say "never this
domain".

And the tabs most likely to be stale are the ones a suspender extension has already parked. Tab
Suspender navigates a parked tab to `chrome-extension://<id>/park.html?…&url=<real URL>`, so the
tab no longer has an http(s) URL and is silently dropped from every archive path. The real URL is
sitting in that query string, unused. Measured: `lastAccessed` survives parking intact, so these
tabs age correctly — they just become invisible.

## What Changes

- **Domain exclusion list**: a settings field listing domains to never archive (one per line).
  Matching is on hostname, case-insensitive, and covers subdomains — `notion.com` also excludes
  `app.notion.com`. Entries are forgiving: a pasted URL or a leading `www.` is normalized down to
  a hostname. Excluded tabs are dropped from staleness candidacy AND refused by the immediate
  shortcut (this is a "never archive this" rule, not a staleness heuristic), reported as skipped
  rather than failing.
- **Suspended-tab URL extraction** (setting "Tab Suspender compatibility: extract URL", default
  **on**): when a tab's URL is an extension placeholder carrying a real http(s) URL in its query
  or hash, that real URL is recovered and used for staleness eligibility, journal dedup, the
  archived page's URL property, and the bookmark block. The original page title is recovered the
  same way when the placeholder carries one. Detection is generic (any extension placeholder with
  a URL-valued parameter), not hardcoded to one extension id.
- **Page capture is skipped for recovered tabs**: a parked tab's DOM is the placeholder, not the
  real page, so rich content capture would archive the suspender's own UI. Such tabs fall back to
  link-only with a warning even when content depth is "rich".
- **Hardening**: `UserStore.save()` now writes plain data, so a future array-valued setting cannot
  be corrupted by MobX observable serialization (the failure already seen with the archive target).

Both settings default to preserving current behavior for the exclusion list (empty) while the
suspender setting defaults on, since recovering a real URL is strictly better than dropping the
tab.

## Capabilities

### New Capabilities

<!-- none — extends existing capabilities -->

### Modified Capabilities

- `stale-tab-detection`: candidacy gains a domain-exclusion rule and evaluates the _resolved_ URL
  so parked tabs are no longer dropped for having an extension scheme.
- `tab-archiving`: the archived page uses the resolved URL and title; the immediate shortcut
  honours domain exclusions; skipped reasons are reported.
- `page-content-capture`: capture is skipped for a tab whose URL was recovered from a placeholder.
- `archive-settings`: two new controls, plus the storage-shape guarantee for list-valued settings.

## Impact

- **New module**: `libs/suspendedTabs.ts` (pure URL recovery + domain matching helpers).
- **Touched**: `libs/staleness.ts`, `stores/StaleTabsStore.tsx`, `background/NotionArchiver.tsx`,
  `stores/UserStore.tsx`, `components/Toolbar/SettingsDialog.tsx`.
- **No new permissions** and no Notion API surface change.
- `SettingsDialog` gains two controls — snapshot-sensitive per AGENTS.md.
