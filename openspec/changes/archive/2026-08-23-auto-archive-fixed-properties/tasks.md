## 1. Persistence

- [x] 1.1 Add `autoFixedProperties?: FixedProperty[]` to `ArchiveTarget` in
      `libs/notion/types.ts`, documented as auto-run-only; verify `pnpm build` type-checks.
- [x] 1.2 Heal and read the new list in `libs/notion/storage.ts` alongside `fixedProperties`
      (same `asArray` repair for the list and for `multi_select` values); verify a target saved
      with auto properties reads back as a plain array.
- [x] 1.3 Preserve `autoFixedProperties` in the `resolveTarget` handler of
      `background/NotionArchiver.tsx` only when `dataSourceId` is unchanged, matching
      `fixedProperties`; verify re-resolving the same target keeps both lists and switching
      targets drops both.

## 2. Payload merge

- [x] 2.1 Add a merge helper in `libs/notion/api.ts` that combines two reconciled
      `{properties, warnings}` results: `multi_select` unions by option name preserving
      always-on-first order, every other type takes the auto value, warnings concatenate; verify
      with the spec's union and override scenarios.
- [x] 2.2 Make `NotionArchiver.prepareFixedProperties` take the trigger flag, reconcile both sets
      against the single fresh schema fetch, and return the merged result; verify a manual run's
      payload is unchanged and an auto run's payload carries the extra properties.
- [x] 2.3 Pass the flag from both call sites (`runAutoArchive` → `true`, `archiveTabs` → the
      request's `auto`); verify by archiving via dialog, shortcut, and a forced alarm run.

## 3. Settings UI

- [x] 3.1 Parameterize `FixedPropertiesEditor` in `components/Toolbar/SettingsDialog.tsx` over its
      rows, commit callback, label, and testids; verify the existing editor still renders and
      saves unchanged.
- [x] 3.2 Add `autoFixedProperties` computed + `setAutoFixedProperties` action to
      `stores/NotionStore.tsx`, persisting with `toJS` like `setFixedProperties`; verify the saved
      value survives a popup reload.
- [x] 3.3 Render the second editor inside the gated block under the auto-archive controls, labelled
      as applying to automatic runs only; verify it is disabled until token+target are verified.

## 4. Wrap-up

- [x] 4.1 Reference the touched specs in the docstrings of the changed modules per repo policy.
- [x] 4.2 Run `pnpm build` and stop there; flag the settings-dialog Linux snapshot refresh as
      follow-up work needing human approval (AGENTS.md).
