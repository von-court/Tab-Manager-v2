## Why

Auto-archive never runs in an actively used browser. `NotionArchiver`'s constructor calls
`reconcileAlarm()` on every MV3 service-worker start, and that unconditionally calls
`alarms.create(AUTO_ARCHIVE_ALARM, …)`, which cancels and replaces the existing alarm — restarting
the 30-minute countdown from zero. The service worker is torn down after ~30 s idle and respawns on
any registered event (`tabs.onActivated`, `windows.onFocusChanged`, `storage.onChanged`,
`runtime.onMessage`, omnibox, …), i.e. every few minutes of normal browsing. The alarm is therefore
reset faster than its period can elapse, and the feature only fires if the browser stays
event-quiet for a full half hour.

The `auto-archive` spec is complicit: it calls the reconcile "idempotent", which `create()` is with
respect to the alarm's _existence_ but not its _schedule_.

## What Changes

- `reconcileAlarm` SHALL preserve a healthy existing alarm: read it with `alarms.get` and only
  create when it is missing or its period no longer matches `AUTO_ARCHIVE_PERIOD_MINUTES`.
  Clearing when the feature is disabled is unchanged.
- Enabling auto-archive SHALL schedule the first run promptly (a short `delayInMinutes`) instead
  of leaving the user to wait a full period with no sign the setting took effect.
- Tighten the `auto-archive` requirement so "idempotent" is stated in terms of the alarm's
  _schedule_, closing the gap that let this implementation read as spec-compliant.
- No behavioral change to what a run does once it fires; no settings, storage, or UI change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `auto-archive`: "Scheduled unattended archiving" gains schedule-preservation and
  first-run-after-enable requirements, replacing the ambiguous "created/cleared idempotently".

## Impact

- `packages/extension/src/js/background/NotionArchiver.tsx` — `reconcileAlarm` only.
- No manifest, permission, storage, or message-protocol change.
- Behavioral: users with auto-archive already enabled will see it start firing — for the first
  time, in practice. The existing per-run cap (`autoArchiveMaxPerRun`, default 5) and the 7-day
  journal dedupe bound the first wave.
