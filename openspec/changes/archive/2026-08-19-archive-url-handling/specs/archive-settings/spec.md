# archive-settings

## ADDED Requirements

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
