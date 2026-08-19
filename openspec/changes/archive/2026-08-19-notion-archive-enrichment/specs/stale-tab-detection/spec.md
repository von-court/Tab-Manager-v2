# stale-tab-detection

## MODIFIED Requirements

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
