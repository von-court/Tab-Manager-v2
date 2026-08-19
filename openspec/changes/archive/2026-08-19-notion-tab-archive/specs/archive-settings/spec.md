# archive-settings

## ADDED Requirements

### Requirement: Notion settings panel

The system SHALL add one "Notion tab archive" panel to the existing settings dialog containing:
a password-style token field with show/hide and a Verify action, a target-DB picker (combobox
searching databases shared with the integration, showing the resolved property mapping as a
hint), a staleness-threshold slider (1–72 h, default 3 h), an auto-archive toggle, and a per-run
cap control. Auto-archive controls SHALL be disabled until token and target are verified.

#### Scenario: Configuring from scratch

- **WHEN** the user opens settings, pastes a valid token, verifies, and picks a shared DB
- **THEN** the mapping hint (e.g. "Title → Name, URL → Link") is shown and archive features
  become available

#### Scenario: Auto controls gated

- **WHEN** no verified token+target exists
- **THEN** the auto-archive toggle and cap control are disabled

### Requirement: Settings storage split

The system SHALL persist sync-safe preferences (`staleThresholdHours`, `autoArchiveEnabled`,
`autoArchiveMaxPerRun`) via the existing `DEFAULT_SETTINGS`/`storage.sync` mechanism. The Notion token,
archive target, and journal SHALL never be added to `DEFAULT_SETTINGS` and SHALL persist only in
`chrome.storage.local` via the dedicated Notion storage module.

#### Scenario: Preference sync

- **WHEN** the user changes the staleness threshold
- **THEN** the value persists through the existing settings mechanism (storage.sync)

#### Scenario: Secret isolation

- **WHEN** all settings are saved
- **THEN** no token, target, or journal data exists in any storage.sync key
