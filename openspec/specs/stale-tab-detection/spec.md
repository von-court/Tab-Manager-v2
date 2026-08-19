# stale-tab-detection Specification

## Purpose

Determines which open tabs count as "stale" and are eligible for archiving — the exclusion
rules that always apply, and dedup against the archive journal so restored tabs aren't
re-proposed.

## Requirements

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
automatic modes: the active tab of each window, audible tabs, tabs whose URL scheme is not
http(s) (e.g. `chrome://`, `brave://`, `about:`, `chrome-extension://`, `file://`), tabs that are
still loading or have an empty URL. Pinned-tab exclusion and grouped-tab exclusion SHALL each be
controlled by an independent settings toggle (`excludePinnedTabs`, `excludeGroupedTabs`), both
defaulting to **on**. A grouped tab is one whose `groupId` is not `-1`.

#### Scenario: Pinned stale tab

- **WHEN** `excludePinnedTabs` is on (default) and a pinned tab has been idle beyond the
  threshold
- **THEN** it is not proposed and never auto-archived

#### Scenario: Pinned exclusion disabled

- **WHEN** `excludePinnedTabs` is off and a pinned tab has been idle beyond the threshold
- **THEN** it is eligible for staleness candidacy like any other tab

#### Scenario: Grouped tab excluded (default)

- **WHEN** `excludeGroupedTabs` is on (default) and a tab that belongs to a Chrome tab group has
  been idle beyond the threshold
- **THEN** it is not proposed and never auto-archived

#### Scenario: Grouped tab exclusion disabled

- **WHEN** `excludeGroupedTabs` is off and a tab that belongs to a Chrome tab group has been idle
  beyond the threshold
- **THEN** it is eligible for staleness candidacy like any ungrouped tab

#### Scenario: Internal browser page

- **WHEN** a `brave://settings` tab has been idle beyond the threshold
- **THEN** it is not proposed and never auto-archived, regardless of the pinned/grouped settings

### Requirement: Journal-based dedup

The system SHALL exclude a tab from staleness candidacy when its URL appears in the archive
journal within the dedup window (7 days), so restored or re-opened tabs are not re-archived.

#### Scenario: Recently archived URL reopened

- **WHEN** a tab's URL was archived to Notion 2 days ago and the tab is idle beyond the threshold
- **THEN** the tab is not proposed for archiving

#### Scenario: Journal entry older than dedup window

- **WHEN** a tab's URL was archived 10 days ago and the tab is idle beyond the threshold
- **THEN** the tab is proposed for archiving again

### Requirement: Effective URL resolution

When the "extract URL" compatibility setting is on (default), the system SHALL resolve a tab whose
URL is an extension placeholder carrying a real http(s) URL in its query string or hash fragment
to that real URL, and use the resolved URL for every URL-dependent decision: http(s) eligibility,
domain exclusion, and journal dedup. Detection SHALL be generic across suspender extensions, not
tied to a specific extension id. When the setting is off, the placeholder URL is used as-is and
the tab is therefore excluded as a non-http(s) URL.

#### Scenario: Parked tab becomes eligible

- **WHEN** a tab's URL is `chrome-extension://<id>/park.html?title=X&url=https%3A%2F%2Fexample.com%2Fa`
  and the setting is on
- **THEN** the tab is treated as `https://example.com/a` and is eligible for archiving

#### Scenario: Extraction disabled

- **WHEN** the same tab is evaluated with the setting off
- **THEN** the tab is excluded, because its URL is not http(s)

#### Scenario: Placeholder without a recoverable URL

- **WHEN** a tab's URL is an extension page with no parameter holding an http(s) URL
- **THEN** no resolution occurs and the tab remains excluded

#### Scenario: Dedup uses the resolved URL

- **WHEN** a parked tab resolves to a URL already archived within the dedup window
- **THEN** the tab is not proposed again

### Requirement: Domain exclusion list

The system SHALL let the user list domains that are never archived. A tab is excluded when its
resolved URL's hostname equals a listed domain or is a subdomain of it, compared
case-insensitively. Entries SHALL be normalized so a pasted URL or a leading `www.` still yields a
usable hostname, and blank lines are ignored. An empty list excludes nothing.

#### Scenario: Subdomain covered by a parent entry

- **WHEN** the list contains `notion.com` and a stale tab is on `app.notion.com`
- **THEN** the tab is not proposed and is never auto-archived

#### Scenario: Unrelated domain not matched

- **WHEN** the list contains `notion.com` and a stale tab is on `notionary.example.com`
- **THEN** the tab is proposed normally

#### Scenario: Forgiving entry format

- **WHEN** the user types `https://app.notion.com/page` or `www.notion.com` as an entry
- **THEN** it is treated as the hostname `app.notion.com` / `notion.com` respectively
