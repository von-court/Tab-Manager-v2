# Design: notion-tab-archive

## Context

Fork of `xcv58/Tab-Manager-v2` (von-court/Tab-Manager-v2, `~/repos/tab-manager-v2`). pnpm
workspace; the extension lives in `packages/extension` (Webpack 5, TypeScript, React 18, MobX 6,
bare imports with `baseUrl: src/js`). Chrome/Brave build is MV3 (`src/manifest-v3.json`, service
worker background); Firefox is MV2. The manifest is transformed per-browser in
`webpack.config.js` (~L158–210); `host_permissions` passes through untouched for Chrome.

Today the extension makes **no network calls** and has no `host_permissions` or `alarms`
permission. `background.tsx` dispatches runtime messages through a synchronous `actionMap`
(constants in `libs/actions.tsx`); the repo uses `webextension-polyfill`. Settings persist through
`stores/UserStore.tsx` `DEFAULT_SETTINGS` into **`storage.sync`**. The settings UI is
`components/Toolbar/SettingsDialog.tsx` (snapshot-sensitive per AGENTS.md). Useful precedents:
`components/Toolbar/RemoveDuplicated.tsx` (bulk-action toolbar button), `ShortcutStore.shortcuts`
(feeds both keyboard shortcuts and the command palette), `components/ui/` primitives (Dialog,
Checkbox, Switch, Slider, Combobox, Snackbar — no TextField yet).

Deployment: personal use — built with `pnpm --filter tab-manager-v2 build:chrome`, loaded
unpacked in Brave. Not store-published from this fork.

## Goals / Non-Goals

**Goals:**

- Propose stale tabs for archiving; on confirm, create one simple Notion page per tab in a
  user-selected existing DB, then close the tab.
- Optional unattended auto-archive on a schedule (off by default), with hard safety rails.
- Keep the Notion layer and journal reusable for v2 (topic-based tab groups synced with Notion).
- Keep the diff upstream-sync-friendly: ~90 % new files, append-style edits elsewhere.

**Non-Goals:**

- v2 topic grouping / two-way sync (design seams only).
- Enriching Notion pages beyond Title + URL (+ bookmark block) — 2nd-brain processing happens in
  Notion.
- Firefox/MV2 support for this feature.
- OAuth; publishing the feature to extension stores.

## Decisions

1. **Staleness from native `tab.lastAccessed`** (Chromium ≥121; Brave ✓) rather than extending
   `background/TabHistory.tsx` with timestamps. Browser-maintained, survives SW restarts and
   browser restarts, zero storage bookkeeping. Missing `lastAccessed` ⇒ _not_ stale (conservative).
   Alternative (TabHistory timestamps) rejected: new storage schema, write amplification on every
   `onActivated`, MV3 ephemerality bookkeeping. Escape hatch: staleness logic is a pure module
   (`libs/staleness.ts`), so a different data source later doesn't touch callers.
2. **Token + all Notion I/O only in the MV3 service worker.** The popup messages the SW via the
   existing `actionMap` (new `NOTION-*` actions). `host_permissions` for `api.notion.com` exempts
   SW fetches from CORS; the page CSP never applies. The token never enters popup state.
3. **Token and archive target in `chrome.storage.local`, never `storage.sync`.** `UserStore`
   auto-persists all `DEFAULT_SETTINGS` to sync — so token/target live in a dedicated
   `libs/notion/storage.ts` module and a `NotionStore`, not in `UserStore` (guard comment at
   `DEFAULT_SETTINGS`). Sync-safe preferences (threshold, auto toggle, cap) do go in
   `DEFAULT_SETTINGS`.
4. **Pinned `NOTION_VERSION` (2025-09-03) + single shape-aware resolver.** Under recent Notion API
   versions, search returns `data_source` objects and pages are created against
   `parent: { data_source_id }`. `resolveTarget()` is the only code that knows the response shape
   and produces `ArchiveTarget {databaseId, dataSourceId, title, titlePropName, urlPropName|null}`.
   Verify `/v1/search` output empirically with the real token before freezing types.
5. **Property mapping by type, not name.** Title = the unique `type:"title"` property. URL = first
   `type:"url"` property (tie-break `/url|link/i`); if none, URL goes only into a `bookmark` block
   child. The bookmark block is appended in every case (always clickable). No attempt to satisfy
   arbitrary schemas — schema rejections surface as per-tab errors.
6. **Journal before close.** Per tab: create page → append journal entry
   (`{url, title, pageId, archivedAt, auto}`, storage.local, pruned to 500) → `tabs.remove`.
   A crash can lose a tab close, never an archived-page record. Journal powers dedup (7-day
   window), an "archived N d ago" badge, recovery, and the v2 identity map.
7. **`chrome.alarms` for auto mode** (period 30 min, reconciled on SW start and on
   `autoArchiveEnabled` changes via `storage.onChanged`). Every run reads all state from storage —
   zero in-memory assumptions (MV3 SW is ephemeral). Oldest-first, capped by
   `autoArchiveMaxPerRun` (default 5).
8. **Promise-aware `onMessage`.** Handlers may return a Promise; the listener returns it and the
   webextension-polyfill wires the response channel. Minimal, commented edit — the one
   behaviorally-shared change.
9. **Chrome-manifest-only permissions.** `alarms` + `host_permissions` added to
   `src/manifest-v3.json` only; Firefox MV2 manifest untouched; UI is capability/config-gated.

## Risks / Trade-offs

- [Notion API version/shape drift] → pinned version constant; `resolveTarget()` is the single
  shape-aware site; persist both databaseId and dataSourceId; empirical verification first.
- [Token leak via storage.sync] → dedicated storage.local module; never in `DEFAULT_SETTINGS`;
  guard comment. Residual: storage.local is unencrypted on disk — acceptable for a personal
  machine; noted, not mitigated further in v1.
- [MV3 SW ephemerality] → alarms not timers; top-level listeners; storage-driven runs; journal
  written before close; per-run caps keep runs short (~350 ms spacing ≈ 3 rps, batch cap 25).
- [Archiving a needed tab] → manual mode default; auto off by default; pinned/active/audible
  always excluded in both modes; journal keeps pageId+url for recovery.
- [Async onMessage regression] → promise-return preserves sync handlers; smoke existing actions
  (toggle popup, last-active-tab) after the change.
- [Playwright snapshot churn] → toolbar button renders only when configured; dialogs closed by
  default; only SettingsDialog snapshots affected — flag, don't regenerate unbidden (AGENTS.md).
- [Upstream merge conflicts] → new files dominate; ~9 touched files get append-style edits.

## Migration Plan

Feature chunks land on `feat/notion-tab-archive`, each ending with a green
`pnpm --filter tab-manager-v2 build:chrome` + manual smoke in Brave (per AGENTS.md: build-only
verification by default; unit tests only when asked). Rollback = revert the branch; no data
migrations. User-side setup: create/reuse an internal Notion integration, share the target DB
with it, paste the token in settings.

## Open Questions

- Exact `/v1/search` response shape under `Notion-Version: 2025-09-03` (data_source vs database
  objects) — resolve empirically in the first Notion-client task before freezing `resolveTarget`.
- Keyboard shortcut choice (`shift+a` proposed) — confirm unbound in `ShortcutStore`.
