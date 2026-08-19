# Proposal: notion-tab-archive

## Why

Open tabs accumulate for days or weeks and become a cognitive burden — people collect them and
never close them. Tab Manager v2 already gives an overview of all tabs, but offers no way to get
stale tabs _out_ of the browser without losing them. Archiving stale tabs as pages in a Notion
database turns tab clutter into 2nd-brain input: the tab closes, the reference survives, and
further processing happens in Notion (by the user or another app).

## What Changes

- Detect **stale tabs**: no activity for a configurable threshold (default 3 h), based on
  Chromium's native `tab.lastAccessed`. Pinned, active, audible, non-http(s), and
  recently-archived tabs are always excluded.
- **Manual review flow**: a toolbar button (+ command-palette entry / keyboard shortcut) opens a
  review dialog listing proposed stale tabs; the user confirms a selection, one simple Notion page
  (Title + URL) is created per tab in a user-selected existing Notion DB, and each successfully
  archived tab is closed. Failed tabs are never closed.
- **Automatic mode** (settings toggle, default off): a `chrome.alarms`-driven background job
  archives stale tabs on a schedule without confirmation, capped per run.
- **Notion connectivity**: internal-integration token pasted into settings, stored in
  `chrome.storage.local` only (never `storage.sync`); all Notion network I/O happens exclusively
  in the MV3 service worker. New `host_permissions` for `https://api.notion.com/*` and `alarms`
  permission (Chrome/Brave MV3 manifest only; Firefox MV2 untouched).
- **Archive journal** in `chrome.storage.local` (URL, title, Notion page id, timestamp): powers
  dedup (don't re-archive restored tabs), recovery, and the future v2 topic-sync identity map.
- Settings additions: Notion token + target-DB picker + verification, staleness threshold,
  auto-archive toggle and per-run cap.

No breaking changes to existing Tab Manager v2 behavior; the feature is invisible until a Notion
token is configured.

## Capabilities

### New Capabilities

- `stale-tab-detection`: which tabs count as "stale" and are eligible for archiving; exclusion
  rules and dedup against the archive journal.
- `notion-connection`: authenticating to Notion with an internal-integration token, selecting the
  target database/data source, resolving the Title/URL property mapping, token storage and
  security constraints.
- `tab-archiving`: converting tabs into Notion pages and closing them — the manual review/confirm
  flow, partial-failure handling, journaling, and user feedback.
- `auto-archive`: scheduled unattended archiving via `chrome.alarms`, its safety rails and caps.
- `archive-settings`: the settings surface for token, DB picker, threshold, and auto-archive
  controls.

### Modified Capabilities

<!-- none — no existing openspec/specs; existing extension behavior is unchanged -->

## Impact

- **Manifest (Chrome/Brave only)**: `src/manifest-v3.json` gains `alarms` permission and
  `host_permissions: ["https://api.notion.com/*"]`. First outbound network capability of the
  extension — privacy posture changes (documented; fork-only, not store-published).
- **New modules (~90 % of the code)**: `libs/staleness.ts`, `libs/notion/{types,client,api,storage}.ts`,
  `background/NotionArchiver.tsx`, `stores/NotionStore.tsx`, `stores/StaleTabsStore.tsx`,
  `components/StaleTabs/ReviewDialog.tsx`, `components/Toolbar/ArchiveStale.tsx`,
  `components/ui/TextField.tsx`.
- **Touched existing files (append-style edits, ~9 files)**: `background.tsx` (promise-aware
  `onMessage`, register archiver actions), `libs/actions.tsx` (`NOTION-*` constants),
  `stores/{index,UserStore,Tab,Window,ShortcutStore}.tsx`, `components/Main.tsx`,
  `components/Toolbar/{Toolbar,SettingsDialog}.tsx`.
- **Dependencies**: none added — plain `fetch` against the Notion REST API (pinned
  `Notion-Version`).
- **Snapshot-sensitive UI** (per AGENTS.md): only `SettingsDialog` snapshots are affected (new
  panel); toolbar button renders only when Notion is configured, dialogs are closed by default.
- **Upstream syncs**: fork of `xcv58/Tab-Manager-v2`; modularity keeps merge surface small.
