## Context

`chrome.alarms.create(name, …)` cancels and replaces any alarm with the same name — it is
idempotent in the alarm's existence, not in its schedule. `NotionArchiver`'s constructor runs on
every MV3 service-worker start and calls `reconcileAlarm()`, so every wake-up rewound the
30-minute countdown. Because the extension registers top-level listeners for tab activation,
window focus, storage changes, runtime messages and the omnibox, the worker respawns every few
minutes of normal use, and the countdown effectively never completed.

## Goals / Non-Goals

**Goals**

- A service-worker restart must not move the next run.
- Enabling the feature must produce a run the user can observe, without a 30-minute wait.
- Keep the reconcile the single place that owns alarm lifecycle.

**Non-Goals**

- Changing the period, the per-run cap, the staleness rules, or anything a run does.
- Persisting run history or a "next run at" indicator in the UI. Worth doing, separate change.
- Reducing how often the service worker restarts.

## Decisions

**Read before write.** `reconcileAlarm` calls `alarms.get(AUTO_ARCHIVE_ALARM)` first and returns
early when an alarm exists with `periodInMinutes === AUTO_ARCHIVE_PERIOD_MINUTES`. Only a missing
alarm or a period mismatch triggers `create`. The period comparison is what makes a future change
to `AUTO_ARCHIVE_PERIOD_MINUTES` take effect on the next reconcile without any migration step.

_Alternative rejected:_ moving alarm creation to `runtime.onInstalled` + `onStartup`. That is the
other common MV3 pattern, but it drops the alarm whenever those events are missed (profile sync,
crash recovery, a disable/enable cycle) and would leave the settings-toggle path needing its own
creation call anyway. Reconcile-on-every-start is more robust once it stops resetting the schedule.

**Explicit first delay.** `create` passes `delayInMinutes: AUTO_ARCHIVE_FIRST_DELAY_MINUTES` (1)
alongside `periodInMinutes`. Without it, Chrome's first fire is one full period out, so enabling
the feature looks inert for half an hour — which is exactly how this bug presented. One minute is
long enough to survive a settings dialog left open and a few toggles, short enough to read as
immediate.

**Clear stays unconditional.** The disabled branch still calls `alarms.clear` without a preceding
`get`; clearing a nonexistent alarm is a no-op and the extra round-trip buys nothing.

## Risks / Trade-offs

- **A first wave of archives.** Anyone who had auto-archive enabled has been accumulating stale
  tabs that were never swept. The first working run is capped at `autoArchiveMaxPerRun` (default 5)
  and the 7-day journal dedupe prevents re-archiving, so the wave drains a few tabs per 30 minutes
  rather than all at once. This is the feature finally working, but it will feel like a change.
- **Not covered by automated tests.** The repo has no service-worker tests and `sinon-chrome`'s
  alarms stub would only prove the branch logic, not Chrome's replace semantics. Verification is
  by reading plus a manual check in `chrome://extensions` → service worker → `chrome.alarms.getAll()`.

## Migration Plan

None. No stored state, no manifest change. An existing alarm with the right period is adopted as
is on the first reconcile after update.
