# Proposal: notion-archive-enrichment

## Why

`notion-tab-archive` shipped with three behaviors hardcoded that real usage has already
outgrown: pinned tabs are always excluded but grouped tabs are never considered at all, every
archived page gets only a title/URL/bookmark with no way to pre-tag it for downstream
processing (e.g. a "Tags" property so archived pages are recognizable as web clips), and every
page captures a bare bookmark even when the user would rather keep the actual content of a page
that's about to disappear from their tabs forever. This change makes all three configurable,
defaulting to today's exact behavior so nothing breaks for anyone who doesn't touch the new
settings.

## What Changes

- **Configurable staleness exclusions**: two independent settings toggles — "exclude pinned
  tabs" (default **on**, matching today's always-on behavior, now user-toggleable) and "exclude
  grouped tabs" (default **on**) which excludes any tab that is a member of a Chrome tab group
  (`tab.groupId !== -1`). Both apply identically in manual review and auto-archive.
- **Configurable fixed properties**: a settings UI to define a list of `property name → static
value` pairs, populated from the real property list already fetched when resolving the archive
  target (so the user picks an existing property and a value shaped to its type — e.g. a
  `select`/`multi_select` option — rather than free-typing). Every archived page gets these fixed
  properties set in addition to title/URL. A configured property that no longer exists on the DB
  (schema drift) fails that one property write per the existing partial-failure pattern — logged,
  surfaced per tab — without blocking the rest of the archive.
- **Configurable page content depth**: a setting — "Bookmark only" (today's exact behavior,
  default) vs "Bookmark + page content" — that, when richer, extracts the tab's main text (and
  first significant image, best-effort) via a content script run in the tab immediately before
  archiving, and appends it to the created page as additional blocks. Falls back to bookmark-only
  automatically (never blocks the archive) when extraction fails, the tab can't be scripted
  (e.g. `chrome://`, PDF viewer), or the image can't be attached. This is the most involved part
  of the change — see `design.md` for the extraction/permission/chunking tradeoffs — and gets its
  own capability rather than folding into `tab-archiving`.

No breaking changes: every new setting defaults to reproducing current behavior exactly. Existing
archived pages and existing settings are untouched.

## Capabilities

### New Capabilities

- `page-content-capture`: extracting a tab's main text and lead image via a content script before
  archiving, and converting that into additional Notion blocks (with size/chunking limits and a
  bookmark-only fallback on any failure).

### Modified Capabilities

- `stale-tab-detection`: exclusion rules become settings-driven for pinned and grouped tabs
  instead of pinned being hardcoded and grouped tabs being unhandled.
- `tab-archiving`: "Simple page content" requirement changes from title/URL-only to
  title/URL/bookmark **plus** configured fixed properties, and to optionally including
  `page-content-capture` output; partial-failure handling extends to per-property failures.
- `archive-settings`: the settings panel gains the two exclusion toggles, the fixed-properties
  editor, and the content-depth control.

## Impact

- **New modules**: `libs/notion/contentCapture.ts` (or similar) for the content-script
  extraction + block-building logic; a fixed-properties editor component in
  `components/Toolbar/SettingsDialog.tsx`.
- **Touched existing files**: `libs/staleness.ts` (groupId/pinned exclusion becomes
  parameterized), `background/NotionArchiver.tsx` (reads new settings, calls content capture,
  sends fixed properties), `libs/notion/api.ts` (`createArchivePage` accepts extra properties +
  extra blocks), `libs/notion/types.ts` (`ArchiveTarget`/settings shapes grow), `stores/UserStore`
  and/or `stores/NotionStore` (new settings), `components/Toolbar/SettingsDialog.tsx`
  (snapshot-sensitive — new controls affect its snapshots).
- **New permission**: `scripting` (and reliance on `activeTab`/host access already granted via
  `<all_urls>`-scoped tabs) to run the content-extraction script — only exercised when content
  depth is set beyond "Bookmark only". No new _host_ permission beyond what tab access already
  implies; `api.notion.com` access is unchanged.
- **Notion API surface**: page creation now includes additional page-content children blocks
  (paragraph, image) beyond the existing bookmark block, and additional properties in the same
  `POST /v1/pages` call — no new endpoints.
- **Upstream syncs**: still a fork of `xcv58/Tab-Manager-v2`; new files are additive and
  isolated, keeping merge surface small.
