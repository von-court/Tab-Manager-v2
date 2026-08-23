## Why

Fixed properties are applied to every archived page, so there is no way to tell a page the user
consciously archived from one the unattended run swept up. Marking the automatic ones — e.g. a
`Tags = auto-archived-tab` — lets them be filtered, reviewed, or cleaned out in Notion later,
which is exactly the trust that makes leaving auto-archive on bearable.

## What Changes

- Add an optional second set of static Notion properties, applied **only** on unattended
  auto-archive runs, on top of the always-on fixed properties.
- Add an editor for that set to the Notion settings panel, driven by the same real target schema
  and gated on the same verified token+target as the existing fixed-properties editor.
- Define the merge rule when a property appears in both sets: `multi_select` values are unioned,
  every single-valued type (`select`, `status`, `checkbox`, `number`, `rich_text`) takes the
  auto value.
- Persist the set alongside its `ArchiveTarget` in `chrome.storage.local`, like the existing
  fixed properties — never in `storage.sync`.
- No change to the manual dialog path or the immediate `shift+ctrl+a` shortcut: both keep
  applying only the always-on fixed properties.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `archive-settings`: the Notion settings panel gains an auto-archive property editor, and the
  storage split covers the new mapping.
- `tab-archiving`: the created page's property set depends on whether the run was unattended, and
  the merge rule between the two sets is specified.
- `auto-archive`: an unattended run applies the auto-only property set in addition to the
  always-on one.

## Impact

- `libs/notion/types.ts` — `ArchiveTarget.autoFixedProperties`.
- `libs/notion/storage.ts` — read/heal the new list like `fixedProperties`.
- `libs/notion/api.ts` — merge two reconciled property sets.
- `background/NotionArchiver.tsx` — `prepareFixedProperties` becomes trigger-aware; the existing
  `auto` flag already reaches it.
- `stores/NotionStore.tsx`, `components/Toolbar/SettingsDialog.tsx` — second editor instance.
- Snapshot-sensitive: the settings dialog gains a control (Linux baselines may need a refresh).
