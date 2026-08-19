# auto-archive

## ADDED Requirements

### Requirement: Scheduled unattended archiving

The system SHALL support an automatic mode (default off) that archives stale tabs without
confirmation, driven by a `chrome.alarms` periodic alarm (30-minute period). The alarm SHALL be
reconciled (created/cleared idempotently) on service-worker start and whenever the
`autoArchiveEnabled` setting changes.

#### Scenario: Enabling auto mode

- **WHEN** the user turns on auto-archive in settings
- **THEN** a periodic alarm is created and archiving runs on each fire without user interaction

#### Scenario: Disabling auto mode

- **WHEN** the user turns off auto-archive
- **THEN** the alarm is cleared and no unattended archiving occurs

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
