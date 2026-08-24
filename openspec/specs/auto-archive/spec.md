# auto-archive Specification

## Purpose

Runs scheduled, unattended archiving of stale tabs via `chrome.alarms`, with the safety rails and
per-run caps that make it safe to leave enabled without supervision.

## Requirements

### Requirement: Scheduled unattended archiving

The system SHALL support an automatic mode (default off) that archives stale tabs without
confirmation, driven by a `chrome.alarms` periodic alarm (30-minute period). The alarm SHALL be
reconciled on service-worker start and whenever the `autoArchiveEnabled` setting changes, and that
reconcile SHALL be idempotent with respect to the alarm's **schedule**: an already-scheduled alarm
with the expected period SHALL be left untouched, so a service-worker restart never postpones the
next run. The alarm SHALL be (re)created only when it is missing or its period differs from the
expected one, and cleared when the feature is disabled. Enabling auto-archive SHALL schedule the
first run within one period, and no later.

#### Scenario: Enabling auto mode

- **WHEN** the user turns on auto-archive in settings
- **THEN** a periodic alarm is created and archiving runs on each fire without user interaction

#### Scenario: Frequent service-worker restarts do not postpone the run

- **WHEN** the service worker is terminated and restarted repeatedly at intervals shorter than the
  alarm period, as ordinary browsing causes
- **THEN** the alarm keeps its original schedule and fires at its due time, rather than restarting
  its countdown on each start

#### Scenario: First run after enabling

- **WHEN** the user turns on auto-archive and stale tabs are already present
- **THEN** the first unattended run happens without waiting a full period

#### Scenario: Disabling auto mode

- **WHEN** the user turns off auto-archive
- **THEN** the alarm is cleared and no unattended archiving occurs

#### Scenario: Period changed by an update

- **WHEN** the extension is updated to a build with a different alarm period and the reconcile runs
- **THEN** the alarm is recreated with the new period

### Requirement: Storage-driven runs

Each auto-archive run SHALL read all required state (settings, token, target, journal) from
storage at fire time and assume no in-memory state, so runs behave correctly after
service-worker restarts. When token or target is missing, the run SHALL no-op.

#### Scenario: Run after service-worker restart

- **WHEN** the alarm fires after the service worker was terminated and restarted
- **THEN** the run completes correctly using only state read from storage

#### Scenario: Unconfigured run

- **WHEN** the alarm fires but no Notion token is stored
- **THEN** the run exits without side effects

### Requirement: Safety rails

Auto-archive SHALL apply the same exclusion rules as manual mode (never pinned, active, audible,
non-http(s), journal-deduped tabs), SHALL process oldest-first, and SHALL archive at most
`autoArchiveMaxPerRun` tabs per run (default 5). Failures are logged and retried naturally on
subsequent runs, never surfaced as interruptions.

#### Scenario: Cap per run

- **WHEN** 12 tabs are stale at alarm fire and the cap is 5
- **THEN** only the 5 longest-idle tabs are archived this run

#### Scenario: Failure during auto run

- **WHEN** a page creation fails during an auto run
- **THEN** the tab stays open, the failure is logged, and the tab is eligible again next run

### Requirement: Unattended runs apply the auto-archive property set

Each unattended run SHALL read the configured auto-archive property set from storage at fire time
along with the rest of its state, and apply it to every page it creates, merged with the
always-on fixed properties per `tab-archiving`. A failure to resolve or apply that set SHALL NOT
abort the run or keep a tab from being archived.

#### Scenario: Set read at fire time

- **WHEN** the alarm fires after the user changed the auto-archive properties and the service
  worker was restarted in between
- **THEN** the run applies the current set, read from storage

#### Scenario: No set configured

- **WHEN** the alarm fires and no auto-archive properties are configured
- **THEN** pages are created exactly as before, with the always-on fixed properties only
