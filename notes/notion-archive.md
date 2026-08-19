# Notion tab archive — design note

Feature: archive stale tabs as pages in a Notion database, then close them.
OpenSpec change: `openspec/changes/notion-tab-archive/` (proposal, design, 5 specs, tasks).

## Architecture

- **Staleness** (`libs/staleness.ts`): pure module over Chromium's native
  `tab.lastAccessed` (≥121; Brave ✓). A tab is stale when idle beyond the
  configurable threshold (default 3 h). Always excluded: pinned, active,
  audible, non-http(s), loading/empty-URL tabs, missing `lastAccessed`
  (conservative), and URLs archived within the 7-day journal dedup window.
- **Notion layer** (`libs/notion/{types,client,api,storage}.ts`), SW-only:
  - `client.ts`: fetch wrapper pinned to `Notion-Version: 2025-09-03`,
    serialized queue (~350 ms spacing ≈ 3 rps), Retry-After on 429 (≤2
    retries), typed `Result` returns.
  - `api.ts`: `testToken`, `searchTargets`, `resolveTargetById`,
    `createArchivePage`. `resolveTarget()` is the ONLY shape-aware code.
    Property mapping by TYPE: title = unique `type:"title"` prop; URL = first
    `type:"url"` prop (tie-break `/url|link/i`), else bookmark-block only.
  - `storage.ts`: storage.LOCAL keys `notionToken`, `notionArchiveTarget`,
    `notionArchiveJournal` (pruned to 500), `notionConnection` (non-secret
    bot name, readable by the popup).
- **Service worker** (`background/NotionArchiver.tsx`): handles the
  `NOTION-*` runtime messages; all token reads and network I/O happen here.
  Per tab: create page → journal entry → close tab (journal-before-close —
  a crash can lose a close, never an archived-page record). Failed tabs are
  never closed. Batch cap 25.
- **Auto-archive**: `chrome.alarms` (`notion-auto-archive`, 30 min),
  reconciled idempotently on SW start and on `autoArchiveEnabled` changes via
  `storage.onChanged`. Every run reads all state from storage (MV3 SW is
  ephemeral). Oldest-first, capped by `autoArchiveMaxPerRun` (default 5).
- **UI**: settings panel in `SettingsDialog` (token + verify, DB combobox
  with mapping hint, threshold slider 1–72 h, auto toggle + cap gated on a
  verified connection); review dialog (`components/StaleTabs/ReviewDialog`)
  via toolbar button (`ArchiveStale`, rendered only when configured),
  `shift+a`, or the command palette.

## Security invariants

- Token, target, and journal live ONLY in `chrome.storage.local` — never in
  `storage.sync` and never in `UserStore.DEFAULT_SETTINGS` (guard comment at
  the definition; that object auto-persists to sync).
- The popup never reads the token key; it reads `notionConnection` for
  status and messages the SW for API work.
- storage.local is unencrypted on disk — accepted for a personal machine
  (documented, not mitigated in v1).

## Empirically verified API shapes (2026-07-15, Notion-Version 2025-09-03)

- `POST /v1/search` with `filter: {property:"object", value:"data_source"}` →
  `data_source` objects with inline typed `properties`, rich-text `title`,
  `parent: {type:"database_id", database_id}`.
- `GET /v1/data_sources/{id}` → same shape.
- `POST /v1/pages` accepts `parent: {type:"data_source_id", data_source_id}`;
  response carries both `data_source_id` and `database_id`. Bookmark child
  blocks accepted. Trash via `PATCH /v1/pages/{id}` `{"in_trash": true}`.

## Repo quirks hit during implementation

- Webpack uses `ts-loader` with `transpileOnly: true` — a green build does
  NOT type-check. `npx tsc --noEmit --types jest,chrome,webpack-env
--skipLibCheck` and grep for the touched files (bare `tsc` drowns in
  pre-existing strict-mode noise; `@types/jasmine` missing).
- `strictNullChecks` is off ⇒ discriminated unions do NOT narrow. `Result<T>`
  is therefore a plain `{ok, value?, error?}` interface, not a union.
- `Tab` store hydrates via `Object.assign(this, tab)` — adding a raw
  `chrome.tabs.Tab` field only needs a declared (observable) class field.
- Manifest edits: Chrome/Brave MV3 only (`src/manifest-v3.json`); the MV2
  manifest stays untouched; `webpack.config.js` passes `host_permissions`
  through for Chrome.

## Snapshot impact (Playwright)

Only `SettingsDialog` snapshots are affected (new "Notion tab archive"
panel). The toolbar button renders only when Notion is configured and both
dialogs are closed by default, so other views are unaffected. Per AGENTS.md:
do not regenerate baselines unbidden; expect `chromium-linux` refreshes as
follow-up after Ubuntu CI runs.

## v2 seams

The journal (`{url, title, pageId, archivedAt, auto}`) doubles as the
identity map for the planned topic-based Notion sync; `resolveTarget()` is
the single place to absorb future Notion API shape drift.

---

# Enrichment follow-up (`notion-archive-enrichment`)

Adds three settings on top of the original feature. All three default to the
previous behavior, so an existing install changes nothing until touched.

## 1. Exclusion settings

`excludePinnedTabs` / `excludeGroupedTabs` (both default **on**) moved the
pinned rule out of `libs/staleness.ts` hardcoding and into caller-supplied
options; grouped = `tab.groupId !== -1`. Both are threaded through the two
call sites that matter: `StaleTabsStore.staleTabs` (manual) and
`NotionArchiver.runAutoArchive` (auto). `stores/Tab.tsx` already carried
`groupId`, so no store change was needed.

## 2. Fixed properties

`ArchiveTarget` grew `properties` (the target's full typed schema, refreshed
on every resolve) and `fixedProperties` (the user's static values). The editor
offers only `select | status | multi_select | checkbox | number | rich_text`.

- **Values may be new.** The driving case is `Tags = "webpage"`, and `Tags` is
  a `multi_select` whose 56 options did _not_ include "webpage". Notion
  auto-creates a missing option on write for `select`/`multi_select` — but NOT
  for `status`, whose options are fixed. So those two types use a free-text
  input with a `datalist` of existing options; `status` stays a plain dropdown.
- **Schema drift** is reconciled against a FRESH `resolveTargetById` fetch once
  per archive run, not against the config snapshot. A missing/retyped property
  becomes a per-tab `warnings[]` entry; the page is still created and the tab
  still closes.

### Gotcha: never persist MobX observables into chrome.storage

`chrome.storage` structured-clones a MobX `ObservableArray` proxy into a
numeric-keyed **object** (`{"0":…,"1":…}`), which then has no `.filter`/`.map`
when read back — it white-screened the settings dialog. Two-part fix:
`NotionStore.setFixedProperties` writes `toJS(...)`, and `getArchiveTarget()`
heals already-corrupted values (outer arrays, nested `options`, and
`multi_select` values) on read.

## 3. Page content capture

`contentDepth: 'bookmark' | 'rich'` (default `bookmark`).

- **Permissions are optional and requested on demand.** `scripting` +
  `http://*/*`,`https://*/*` live in `optional_permissions` /
  `optional_host_permissions`, requested via `chrome.permissions.request()`
  from inside the toggle's click handler (a user gesture is required).
  Declining reverts the control. Extraction re-checks
  `permissions.contains()` at run time and falls back if revoked. This keeps
  the default install exactly as sensitive as before.
  `activeTab` is deliberately NOT used — stale tabs are background tabs.
- **Lead image comes from `og:image`**, not the DOM. Measured on real pages:
  stale tabs are backgrounded, so lazy `<img>`s never load (Wikipedia: 3 of 58
  loaded; MDN: 0), and the few that do load are logos/wordmarks. `og:image`
  (then `twitter:image`) needs no loading and is the page's own declared
  representative image. Largest loaded `<img>` >=200x200 remains a fallback.
- **Limits:** text chunks to <=2000 chars per rich-text item and <=90 generated
  blocks, with a trailing `… (truncated)` marker (one slot reserved for it) so
  a single `POST /v1/pages` stays atomic — no follow-up block appends.
- Any failure (unscriptable tab, timeout, no permission) degrades to
  bookmark-only with a warning and never blocks or fails the archive.

## Testing gotcha

Chrome keeps serving the **old** service worker for an unpacked extension
across relaunches on a persisted profile. Several "the code didn't run"
results were purely stale SWs. Use a fresh `--profile` dir to guarantee the
new bundle is live.

## Snapshot impact (Playwright)

Still `SettingsDialog` only, now with three more controls (two switches, the
fixed-properties editor, the content-depth toggle group). Baselines NOT
regenerated — per AGENTS.md that is follow-up work after Ubuntu CI.

---

# Immediate archive shortcut (`archive-selected-now`)

`shift+ctrl+a` archives the selected tabs — or the focused tab when nothing is
selected — straight away: no staleness check, no review dialog, no
confirmation. It reuses `StaleTabsStore.runArchive()`, the same path the review
dialog uses, so fixed properties, content capture, partial-failure handling and
the journal all behave identically. Selection follows the existing
"selected, else focused" precedent from
`FocusStore.createGroupFromFocusedOrSelectedTabs`.

Staleness, the pinned/grouped exclusions and journal dedup are all deliberately
bypassed (the user pointed at these tabs). The only hard filter is the URL
scheme: non-http(s) tabs stay open and are reported as skipped.

# Interaction with Tab Suspender (extension `fiabciak…`, v2.0.12)

Measured, because it directly affects which tabs are archivable:

- **The staleness threshold is safe.** `lastAccessed` survives BOTH
  `chrome.tabs.discard()` and a navigation to the suspender's `park.html`
  placeholder — verified identical before/after in both cases. Suspending a tab
  does not make it look freshly used, so it keeps ageing toward the threshold.
- **Parked tabs are invisible to the archiver.** Tab Suspender's default path
  navigates the tab to
  `chrome-extension://fiabciak…/park.html?…&url=<real URL>&…`, so `tab.url` is
  no longer http(s) and the exclusion rule drops it. The tabs most likely to be
  stale are therefore the ones that never get proposed. The real URL is
  recoverable from the `url` query parameter if we ever want to unwrap it.
- **Natively discarded tabs archive fine** (url preserved, `status: "unloaded"`,
  which is not excluded) but **cannot be content-captured** — there is no
  renderer to inject into, so rich mode degrades to link-only with a warning.
- `chrome.tabs.discard()` also **changes the tab id**. If a tab is discarded
  between opening the review dialog and confirming, the close targets a stale
  id: the page and journal entry are still created, but the tab silently stays
  open.

---

# Domain exclusions + suspender URL recovery (`archive-url-handling`)

Two settings, both in `libs/suspendedTabs.ts` (pure) and funnelled through one
`resolveTab()` helper in `libs/staleness.ts` so "is this eligible" and "what do
we archive" can never disagree.

- **Excluded domains** — newline-separated text, matched on hostname with
  subdomain coverage (`notion.com` also excludes `app.notion.com`, but not
  `notionary.example.com` — matching is on label boundaries). Entries are
  normalized, so a pasted URL or a `www.` prefix still works. This is a "never
  archive" rule, so unlike the staleness heuristics it also applies to the
  immediate `shift+ctrl+a` shortcut, which reports such tabs as skipped.
- **Tab Suspender compatibility: extract URL** (default on) — recovers the real
  page from an extension placeholder URL. Detection is generic: any
  `chrome-extension:`/`moz-extension:` URL with a parameter (query _or_ hash)
  whose value is an http(s) URL, preferring `url`/`uri`/`u`. Both are needed —
  Tab Suspender uses `park.html?url=`, The Great Suspender forks use
  `suspended.html#uri=`. The original title is recovered from `title`/`ttl` when
  present.

The resolved identity is used everywhere: eligibility, domain matching, journal
dedup, the archived page's URL property and bookmark, and the review dialog
(which shows the real title/domain plus a `· suspended` marker, instead of the
opaque `chrome-extension://…` it would otherwise display).

**Content capture is skipped for recovered tabs** — the renderer holds the
placeholder, so capturing would archive the suspender's own UI. Such tabs fall
back to link-only with a warning even at rich depth. Verified: a parked tab
archived at `contentDepth: 'rich'` produced exactly one bookmark block.

## Storage gotcha, now fixed at the root

`UserStore.save()` wrote `this[key]` straight into `storage.sync`, so any
list-valued setting would have hit the same MobX-observable-array corruption as
the archive target (structured-clone turns it into `{"0":…}`). `save()` now
wraps values in `toJS()`. The excluded-domains field is stored as text anyway,
which sidesteps it entirely, but the hardening means a future list setting
cannot reintroduce the bug.
