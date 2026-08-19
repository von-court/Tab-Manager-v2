# Tasks: archive-url-handling

## 1. Pure helpers

- [x] 1.1 Create `libs/suspendedTabs.ts`: `extractSuspendedUrl(url)` (extension scheme + query and
      hash scan, preferring `url`/`uri`/`u`), `normalizeDomainEntry(entry)`, `parseExcludedDomains(text)`,
      and `isDomainExcluded(url, domains)`
- [x] 1.2 Add `resolveTab(tab, {extractSuspendedUrl})` to `libs/staleness.ts` returning
      `{url, title, recovered}`; make `isStaleTab` use the resolved URL for the http(s) check, the new
      domain-exclusion check, and journal dedup

## 2. Settings

- [x] 2.1 Add `excludedDomains: ''` and `extractSuspendedTabUrl: true` to `DEFAULT_SETTINGS`
      (+ observables/actions); harden `save()` with `toJS()`
- [x] 2.2 Add the excluded-domains textarea and the compatibility toggle to the Notion panel

## 3. Wire the archive paths

- [x] 3.1 `StaleTabsStore`: pass the new options into `getStaleTabs`; send resolved url/title in
      `runArchive`; refuse excluded domains in `archiveSelectedNow` with a distinct skipped reason
- [x] 3.2 `NotionArchiver`: read the new settings, resolve tabs in the auto path, send resolved
      url/title, and skip content capture when the tab was recovered

## 4. Verification

- [x] 4.1 Type-check, lint, `pnpm --filter tab-manager-v2 build:chrome`
- [x] 4.2 Smoke: a park.html-style tab becomes archivable and lands under its real URL/title;
      toggling extraction off re-excludes it; `app.notion.com` is excluded via a `notion.com` entry and
      is refused by the shortcut; rich depth on a parked tab falls back to link-only
