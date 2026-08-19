# archive-settings Specification

## Purpose

Provides the settings surface for configuring the Notion token, target database, staleness
threshold, and auto-archive controls, and defines where each piece of that configuration state
is allowed to live.

## Requirements

### Requirement: Notion settings panel

The system SHALL add one "Notion tab archive" panel to the existing settings dialog containing:
a password-style token field with show/hide and a Verify action, a target-DB picker (combobox
searching databases shared with the integration, showing the resolved property mapping as a
hint), a staleness-threshold slider (1–72 h, default 3 h), an "exclude pinned tabs" toggle
(default on), an "exclude grouped tabs" toggle (default on), a fixed-properties editor (add/remove
`property → static value` pairs, property choices and value inputs driven by the resolved
target's real property list and types), a content-depth control ("Bookmark only" /
"Bookmark + page content", default "Bookmark only"), an auto-archive toggle, and a per-run cap
control. Auto-archive controls and the fixed-properties editor SHALL be disabled until token and
target are verified.

#### Scenario: Configuring from scratch

- **WHEN** the user opens settings, pastes a valid token, verifies, and picks a shared DB
- **THEN** the mapping hint (e.g. "Title → Name, URL → Link") is shown and archive features
  become available

#### Scenario: Auto controls gated

- **WHEN** no verified token+target exists
- **THEN** the auto-archive toggle, cap control, and fixed-properties editor are disabled

#### Scenario: Adding a fixed property

- **WHEN** a verified target is selected and the user adds a fixed property, choosing an existing
  `select` property and one of its options as the value
- **THEN** the pairing is available to pick from the target's real property list (not free text)
  and is saved for use on every future archive

#### Scenario: Exclusion toggles default on

- **WHEN** the panel is opened for the first time
- **THEN** "exclude pinned tabs" and "exclude grouped tabs" are both shown as on, matching prior
  hardcoded behavior for pinned tabs

### Requirement: Settings storage split

The system SHALL persist sync-safe preferences (`staleThresholdHours`, `autoArchiveEnabled`,
`autoArchiveMaxPerRun`, `excludePinnedTabs`, `excludeGroupedTabs`, `contentDepth`) via the
existing `DEFAULT_SETTINGS`/`storage.sync` mechanism. The Notion token, archive target, fixed
property mapping, and journal SHALL never be added to `DEFAULT_SETTINGS` and SHALL persist only
in `chrome.storage.local` via the dedicated Notion storage module, with the fixed property
mapping stored alongside its `ArchiveTarget`.

#### Scenario: Preference sync

- **WHEN** the user changes the staleness threshold, an exclusion toggle, or the content-depth
  setting
- **THEN** the value persists through the existing settings mechanism (storage.sync)

#### Scenario: Secret isolation

- **WHEN** all settings are saved, including fixed properties
- **THEN** no token, target, fixed-property mapping, or journal data exists in any storage.sync
  key

### Requirement: URL handling controls

The settings panel SHALL provide a multi-line field listing excluded domains (one per line,
empty by default) and a toggle labelled for Tab Suspender compatibility that enables recovering a
real URL from a placeholder tab, enabled by default.

#### Scenario: Excluding a domain

- **WHEN** the user adds `app.notion.com` to the excluded-domains field
- **THEN** tabs on that domain stop being proposed and are refused by the immediate shortcut

#### Scenario: Compatibility toggle default

- **WHEN** the panel is opened for the first time
- **THEN** the extract-URL compatibility toggle is on

### Requirement: List-valued settings persist as plain data

Settings that hold a list SHALL be persisted as plain serializable data, so that reading them back
yields the same shape that was written.

#### Scenario: Round-tripping a list setting

- **WHEN** a list-valued setting is saved and later read back
- **THEN** it is returned as a list, not as an object keyed by numeric indices
