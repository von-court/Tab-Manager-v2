## Why

Archiving a page to Notion currently requires opening the Tab Manager popup first: every entry
point (`shift+a`, `shift+ctrl+a`, the toolbar button) lives inside the popup UI. The common case —
"I am done with this page, put it in Notion and get it off my screen" — happens while browsing,
not while managing tabs, and the detour through the popup is enough friction to stop it from
becoming a habit.

## What Changes

- Register a new `chrome.commands` entry, `NOTION-ARCHIVE-CURRENT-TAB`, that archives the active
  tab of the focused window and closes it on success — usable from any page, without opening the
  popup.
- The command ships **without** a `suggested_key`: Chrome allows at most four suggested-key
  commands per extension and all four slots are taken (`_execute_action`, `TOGGLE-POPUP`,
  `LAST-ACTIVE-TAB`, `OPEN-IN-NEW-TAB`). Users bind it in `chrome://extensions/shortcuts`.
- Staleness does not gate it (same rule as the existing immediate archive); excluded domains,
  non-http(s) URLs, and a missing token/target still refuse it.
- The page is created with the always-on fixed properties only — it is a manual archive, so the
  auto-archive property set does not apply.
- Because no popup is open to host a snackbar, the outcome is reported by briefly flashing the
  toolbar action badge (✓ / !) and then restoring whatever `TabCountIcon` was showing.
- Chrome (MV3) only: the Notion archive feature already ships behind the MV3 manifest; the
  Firefox MV2 manifest is untouched.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tab-archiving`: adds a requirement for a browser-level archive command covering tab selection,
  refusal rules, tab closing, and badge feedback; the existing "Staleness rules do not gate the
  immediate archive" requirement is widened to cover this second manual entry point.
- `archive-settings`: the settings panel gains a read-only hint naming the command and pointing at
  `chrome://extensions/shortcuts`, since an unbound command is otherwise invisible.

## Impact

- `packages/extension/src/manifest-v3.json` — new `commands` entry.
- `packages/extension/src/js/libs/actions.tsx` — new action id.
- `packages/extension/src/js/background/NotionArchiver.tsx` — argless command handler that queries
  the active tab, reuses `archiveOneTab` with `auto: false`, writes the journal, closes the tab.
- `packages/extension/src/js/background/TabCountIcon.tsx` / `libs/verify` — badge flash + restore.
- `packages/extension/src/js/components/Toolbar/SettingsDialog.tsx` — shortcut hint.
- No new permissions; no storage-shape change; no change to any existing archive path.
