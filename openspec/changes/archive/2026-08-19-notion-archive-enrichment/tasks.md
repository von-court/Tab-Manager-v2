# Tasks: notion-archive-enrichment

Each numbered group ends with a green `pnpm --filter tab-manager-v2 build:chrome` and a manual
smoke in Brave (AGENTS.md: build-only verification by default; no tests unless asked).

## 1. Exclusion settings

- [x] 1.1 Add `groupId` to `stores/Tab.tsx` (mirrors raw `chrome.tabs.Tab`, hydrated the same way
      `lastAccessed` is)
- [x] 1.2 Extend `StalenessTab`/`StaleTabsOptions` in `libs/staleness.ts` with `groupId` and
      `excludePinnedTabs`/`excludeGroupedTabs` options (default `true` for both); update `isStaleTab`
      to gate pinned/group checks on those flags instead of hardcoding pinned exclusion
- [x] 1.3 Add `excludePinnedTabs: true`, `excludeGroupedTabs: true` to `stores/UserStore.tsx`
      `DEFAULT_SETTINGS`
- [x] 1.4 Wire the two settings through both call sites: `stores/StaleTabsStore.tsx` (manual
      review) and `background/NotionArchiver.tsx` `runAutoArchive` (auto mode)
- [x] 1.5 Add the two toggles to the "Notion tab archive" settings panel
- [x] 1.6 Smoke: pin a stale tab and a grouped stale tab, confirm both excluded by default; flip
      each toggle off, confirm each becomes eligible

## 2. Fixed properties

- [x] 2.1 Extend `resolveTarget`/`resolveTargetById` in `libs/notion/api.ts` to also return the
      raw typed property list (name + type) alongside the existing title/url resolution
- [x] 2.2 Add `FixedProperty { name, type, value }` to `libs/notion/types.ts`, restricted to
      `select | status | multi_select | checkbox | number | rich_text`; add `fixedProperties` to
      `ArchiveTarget` and persist it via `libs/notion/storage.ts` alongside the target (reset when
      target changes)
- [x] 2.3 Build the fixed-properties editor in the settings panel: add/remove rows, property
      dropdown sourced from the resolved target's typed property list (filtered to supported types),
      value input adapting to the selected property's type (select/status/multi_select show real
      options; checkbox toggle; number/rich_text text input)
- [x] 2.4 Extend `createArchivePage` to accept `extraProperties`, fetch a fresh schema at archive
      time, encode each configured property per its Notion type, and catch failures per-property
      (missing/renamed property ⇒ warning on that tab's result, not a blocking error)
- [x] 2.5 Smoke: configure `Tags (select) = webpage` against a real DB, archive a tab, confirm the
      page has `Tags` set; rename/remove the property in Notion, archive again, confirm the page still
      gets created with a per-tab warning instead of failing

## 3. Page content capture

- [x] 3.1 Add `scripting` to `optional_permissions` and `http://*/*`/`https://*/*` to
      `optional_host_permissions` in `src/manifest-v3.json` (Chrome only)
- [x] 3.2 Add `contentDepth: 'bookmark' | 'rich'` (default `'bookmark'`) to `DEFAULT_SETTINGS`;
      wire the content-depth control in settings to call `chrome.permissions.request(...)` in the
      same click handler when switching to `'rich'`, reverting the control if declined
- [x] 3.3 Create `libs/notion/contentCapture.ts`: the injected extraction function (main-text
      heuristic: `article, main` → `document.body` fallback, whitespace-normalized; lead image: largest
      qualifying `<img>` ≥200×200 with a resolvable http(s) `src`) plus the block-building helpers
      (chunk text into ≤2000-char paragraph blocks, cap at 90 total blocks with a truncation marker,
      build an `image` block only when a usable URL was found)
- [x] 3.4 Wire capture into the archive path in `background/NotionArchiver.tsx`: when
      `contentDepth === 'rich'` and the permission is present
      (`chrome.permissions.contains`), run `chrome.scripting.executeScript` against the tab with a 5 s
      timeout race before `createArchivePage`; any failure/timeout/unscriptable-tab ⇒ proceed
      bookmark-only without surfacing an error; append returned blocks after the bookmark block
- [x] 3.5 Smoke: archive a normal article page with `contentDepth: 'rich'`, confirm extracted text
  - lead image land as blocks on the Notion page; archive a `chrome://` tab and a page with no
    qualifying image with the same setting, confirm graceful bookmark-only / text-only fallback

## 4. Polish

- [x] 4.1 Update `notes/notion-archive.md` (or add a follow-up note) documenting the three new
      settings and the optional-permission flow
- [x] 4.2 Flag `SettingsDialog` snapshot impact from the new controls; do not regenerate baselines
      unbidden (AGENTS.md)
- [x] 4.3 Full end-to-end smoke with all three features combined: pinned+grouped exclusions off,
      a fixed property configured, and rich content depth, archiving a mixed batch of tabs in one go
