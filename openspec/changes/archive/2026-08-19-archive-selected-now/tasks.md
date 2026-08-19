# Tasks: archive-selected-now

## 1. Implementation

- [x] 1.1 Extract the send/report half of `StaleTabsStore.archiveCheckedTabs` into a shared
      private `runArchive(tabs)` so both entry points share snackbar/result/journal handling
- [x] 1.2 Add `archiveSelectedNow()` to `StaleTabsStore`: selected-else-focused tabs, dedupe by
      id, drop non-http(s) with a skipped count, no-op when Notion is unconfigured
- [x] 1.3 Bind `shift+ctrl+a` in `stores/ShortcutStore.tsx` with a palette-visible description

## 2. Verification

- [x] 2.1 Type-check, lint, and `pnpm --filter tab-manager-v2 build:chrome`
- [x] 2.2 Smoke: archive the focused tab with nothing selected; archive a multi-tab selection;
      confirm a fresh/pinned tab archives anyway and a `chrome://` tab is reported skipped
