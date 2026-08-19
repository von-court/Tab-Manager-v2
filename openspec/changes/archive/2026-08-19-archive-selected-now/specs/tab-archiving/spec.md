# tab-archiving

## ADDED Requirements

### Requirement: Immediate archive of chosen tabs

The system SHALL provide a shortcut that archives the currently selected tabs — or, when no tabs
are selected, the focused tab — immediately, without opening the review dialog and without
requiring confirmation. Each tab follows the same create-page → journal → close sequence, and the
same batch cap, as the review flow.

#### Scenario: Archiving the focused tab

- **WHEN** no tabs are selected and the user triggers the shortcut on a focused http(s) tab
- **THEN** that one tab is archived to Notion and closed, with no dialog shown

#### Scenario: Archiving a multi-tab selection

- **WHEN** three tabs are selected and the user triggers the shortcut
- **THEN** all three are archived and closed, and a snackbar reports the outcome

#### Scenario: Not configured

- **WHEN** no Notion token or target is configured
- **THEN** the shortcut does nothing

### Requirement: Staleness rules do not gate the immediate archive

Because the user selected the tabs explicitly, the immediate archive SHALL ignore the staleness
threshold, the pinned and grouped exclusion settings, and journal dedup. It SHALL still refuse
tabs whose URL is not http(s), reporting them as skipped rather than failing the run.

#### Scenario: Fresh, pinned, grouped, or already-archived tab

- **WHEN** the user selects a tab that is brand new, pinned, in a tab group, or whose URL was
  archived recently, and triggers the shortcut
- **THEN** the tab is archived and closed anyway

#### Scenario: Non-archivable URL selected

- **WHEN** the selection includes a `chrome://` or other non-http(s) tab
- **THEN** that tab is left open and reported as skipped, while the remaining selected tabs are
  archived normally
