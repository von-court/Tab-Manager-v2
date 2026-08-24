## MODIFIED Requirements

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
