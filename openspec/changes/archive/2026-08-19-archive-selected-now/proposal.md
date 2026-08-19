# Proposal: archive-selected-now

## Why

Archiving today always goes through staleness detection and the review dialog. But the moment you
most want a tab in Notion is when you are looking right at it and are done with it — it is not
stale yet, and opening a dialog to confirm a tab you just deliberately picked is pure friction.
There is no way to say "put this one in Notion and close it, now".

## What Changes

- A new shortcut (`shift+ctrl+a`, pairing with `shift+a` which opens the review dialog) archives
  the **selected tabs** — or the focused tab when nothing is selected — immediately: create the
  Notion page, journal it, close the tab. No staleness check, no dialog, no confirmation.
- Staleness rules (threshold, pinned/grouped exclusions, journal dedup) are deliberately **not**
  applied: the user picked these tabs explicitly. Only the hard constraint survives — a tab whose
  URL is not http(s) cannot be archived and is reported as skipped.
- Reuses the existing archive path, so fixed properties, content-depth capture, per-tab
  partial-failure handling, and the journal all behave exactly as they do in the review flow.
- Feedback is the existing snackbar ("Archived N tabs to Notion" / failures called out); the
  command-palette entry appears automatically from the shortcut registration.

The shortcut is inert until Notion is configured, matching the existing toolbar button.

## Capabilities

### New Capabilities

<!-- none — this extends an existing capability -->

### Modified Capabilities

- `tab-archiving`: adds an immediate, explicit-selection archive path alongside the existing
  stale-tab review flow, including which staleness rules do and do not apply to it.

## Impact

- **Touched files**: `stores/StaleTabsStore.tsx` (new action), `stores/ShortcutStore.tsx` (new
  binding + palette entry). No new modules, no manifest or permission changes, no Notion API
  surface change.
- **No new UI**: no new controls, so `SettingsDialog` snapshots are unaffected. The command
  palette gains a row, which is derived from `ShortcutStore.shortcuts`.
- **Interaction note**: tabs parked by a suspender extension carry a `chrome-extension://` URL and
  are therefore reported as skipped rather than archived — same constraint as the review flow.
