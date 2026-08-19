# stale-tab-detection

## ADDED Requirements

### Requirement: Stale tab identification

The system SHALL classify a tab as stale when `now − tab.lastAccessed` exceeds the configured
staleness threshold (default 3 hours). Staleness computation SHALL be implemented as a pure
function (`libs/staleness.ts`) shared by the popup UI and the background service worker.

#### Scenario: Tab idle beyond threshold

- **WHEN** a tab was last accessed 5 hours ago and the threshold is 3 hours
- **THEN** the tab is classified as stale and eligible for archiving

#### Scenario: Tab recently used

- **WHEN** a tab was last accessed 1 hour ago and the threshold is 3 hours
- **THEN** the tab is not classified as stale

#### Scenario: Missing lastAccessed data

- **WHEN** a tab has no `lastAccessed` value
- **THEN** the tab is treated as not stale (conservative — never archive on missing data)

### Requirement: Exclusion rules

The system SHALL always exclude the following tabs from staleness candidacy, in both manual and
automatic modes: pinned tabs, the active tab of each window, audible tabs, tabs whose URL scheme
is not http(s) (e.g. `chrome://`, `brave://`, `about:`, `chrome-extension://`, `file://`), tabs
that are still loading or have an empty URL.

#### Scenario: Pinned stale tab

- **WHEN** a pinned tab has been idle beyond the threshold
- **THEN** it is not proposed and never auto-archived

#### Scenario: Internal browser page

- **WHEN** a `brave://settings` tab has been idle beyond the threshold
- **THEN** it is not proposed and never auto-archived

### Requirement: Journal-based dedup

The system SHALL exclude a tab from staleness candidacy when its URL appears in the archive
journal within the dedup window (7 days), so restored or re-opened tabs are not re-archived.

#### Scenario: Recently archived URL reopened

- **WHEN** a tab's URL was archived to Notion 2 days ago and the tab is idle beyond the threshold
- **THEN** the tab is not proposed for archiving

#### Scenario: Journal entry older than dedup window

- **WHEN** a tab's URL was archived 10 days ago and the tab is idle beyond the threshold
- **THEN** the tab is proposed for archiving again
