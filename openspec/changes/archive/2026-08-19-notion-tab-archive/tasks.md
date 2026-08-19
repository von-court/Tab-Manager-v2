# Tasks: notion-tab-archive

Each numbered group ends with a green `pnpm --filter tab-manager-v2 build:chrome` and a manual
smoke in Brave (AGENTS.md: build-only verification by default; no tests unless asked).

## 1. Foundation (manifest + staleness)

- [x] 1.1 Verify baseline: `pnpm install`, `pnpm --filter tab-manager-v2 build:chrome`, load `packages/extension/build/build_chrome` unpacked in Brave
- [x] 1.2 Add `alarms` permission and `host_permissions: ["https://api.notion.com/*"]` to `src/manifest-v3.json` (Chrome only; MV2 manifest untouched)
- [x] 1.3 Create pure module `src/js/libs/staleness.ts` — `getStaleTabs(tabs, {thresholdMs, now, journalUrls})` with all exclusion rules (pinned/active/audible/non-http(s)/loading/empty URL/journal-dedup 7 d/missing `lastAccessed` ⇒ not stale)
- [x] 1.4 Add `lastAccessed` field to `stores/Tab.tsx` and hydrate it where Tab copies fields from raw `chrome.tabs.Tab` (likely `stores/Window.tsx`)

## 2. Notion client + background plumbing

- [x] 2.1 Empirically verify `/v1/search` and page-create shapes under `Notion-Version: 2025-09-03` with the real token (curl/scratch), then freeze `ArchiveTarget` types
- [x] 2.2 Create `src/js/libs/notion/types.ts` (`ArchiveTarget`, `ArchiveResult`, journal entry type, typed errors)
- [x] 2.3 Create `src/js/libs/notion/client.ts` — fetch wrapper, `NOTION_VERSION` constant, serialized queue ~350 ms spacing, Retry-After on 429 (≤2 retries), typed errors (401 invalid token, 404 not shared), Result-style returns
- [x] 2.4 Create `src/js/libs/notion/api.ts` — `testToken()`, `searchTargets()`, `resolveTarget()` (only shape-aware code; property mapping by type: title prop + first url prop, tie-break /url|link/i, else null), `createArchivePage()` (title + url prop when mapped + bookmark block always)
- [x] 2.5 Create `src/js/libs/notion/storage.ts` — typed storage.local accessors for `notionToken`, `notionArchiveTarget`, `notionArchiveJournal` (append + prune to 500)
- [x] 2.6 Add `NOTION-TEST-TOKEN`, `NOTION-SEARCH-DATABASES`, `NOTION-RESOLVE-TARGET`, `NOTION-ARCHIVE-TABS` to `libs/actions.tsx`
- [x] 2.7 Create `src/js/background/NotionArchiver.tsx` (class with `actionMap`, like `TabHistory`) — manual path: per tab create page → journal entry → `tabs.remove`; failed tabs never closed; batch cap 25
- [x] 2.8 Make `background.tsx` `onMessage` promise-aware (return handler Promise; polyfill wires response) + register archiver actionMap; smoke existing actions (toggle popup, last-active-tab)

## 3. Settings

- [x] 3.1 Create `components/ui/TextField.tsx` primitive (password variant with show/hide), styled to match existing `components/ui/` controls
- [x] 3.2 Create `stores/NotionStore.tsx` (connection state, target + mapping, journal — all via `libs/notion/storage.ts`); register in `stores/index.tsx`
- [x] 3.3 Add sync-safe prefs to `stores/UserStore.tsx` `DEFAULT_SETTINGS`: `staleThresholdHours: 3`, `autoArchiveEnabled: false`, `autoArchiveMaxPerRun: 5` (+ observables/actions); add guard comment (token/target never here — storage.sync)
- [x] 3.4 Add "Notion tab archive" `SettingsPanel` to `components/Toolbar/SettingsDialog.tsx`: token TextField + Verify (→ NOTION-TEST-TOKEN), DB picker via `useCombobox` (→ NOTION-SEARCH-DATABASES / NOTION-RESOLVE-TARGET, mapping hint), threshold Slider 1–72 h, auto Switch + cap (disabled until verified). Note: snapshot-sensitive file
- [x] 3.5 Smoke: verify token, pick DB, confirm `ArchiveTarget` persisted in storage.local and nothing secret in storage.sync

## 4. Review flow (manual archive)

- [x] 4.1 Create `stores/StaleTabsStore.tsx` (computed `staleTabs` via `libs/staleness.ts` + journal URLs, `dialogOpen`, per-tab check state, progress, results); register in `stores/index.tsx`
- [x] 4.2 Create `components/StaleTabs/ReviewDialog.tsx` (+ row subcomponent) on `components/ui/Dialog.tsx`; mount in `components/Main.tsx` next to `<SettingsDialog />`
- [x] 4.3 Create `components/Toolbar/ArchiveStale.tsx` (modeled on `RemoveDuplicated.tsx`), render only when Notion configured; add to `Toolbar.tsx`
- [x] 4.4 Add ShortcutStore entry (verify `shift+a` unbound) → opens review dialog (auto-appears in command palette + help)
- [x] 4.5 Wire confirm → `NOTION-ARCHIVE-TABS` message → results → per-tab ✓/✗ in dialog + Snackbar summary ("Archived N tabs to Notion" / "M failed — see dialog")
- [x] 4.6 Smoke end-to-end: ≥5 tabs, threshold temporarily tiny, archive → pages in Notion DB, tabs closed; bad-token path leaves tabs open with errors

## 5. Auto-archive

- [x] 5.1 Extend `background/NotionArchiver.tsx`: top-level `chrome.alarms.onAlarm` + `storage.onChanged` watcher on `autoArchiveEnabled`; idempotent alarm reconcile on SW start & setting change (`notion-auto-archive`, 30 min)
- [x] 5.2 Implement storage-driven run: read settings/token/target → `tabs.query({})` → `getStaleTabs()` → oldest-first up to `autoArchiveMaxPerRun` → create→journal→close; missing config ⇒ no-op; failures logged, retried next tick
- [x] 5.3 Smoke: short test period, verify unattended archiving, journal dedup prevents re-archiving, SW-restart resilience

## 6. Polish

- [x] 6.1 "Archived N d ago" badge from journal in review dialog
- [x] 6.2 Write `notes/notion-archive.md` design note (AGENTS.md: internal notes in `notes/`)
- [x] 6.3 Flag SettingsDialog snapshot impact; do not regenerate baselines unbidden
