## ADDED Requirements

### Requirement: Browser-level archive of the active tab

The system SHALL expose a browser-level keyboard command that archives the active tab of the
focused window without opening the popup. The command SHALL be declared with no default key
binding, so it appears in the browser's extension-shortcuts list unassigned until the user binds
it, and SHALL do nothing until then. On trigger the tab SHALL follow the same create-page →
journal → close sequence as every other archive path, receiving the always-on fixed properties;
being a manual archive, it SHALL NOT receive the auto-archive property set. Exactly one tab is
archived per trigger, regardless of any selection state in the popup.

#### Scenario: Archiving the page being read

- **WHEN** the user has bound the command and presses it while viewing an http(s) page, with a
  verified token and target configured
- **THEN** a Notion page is created for that tab, the journal records it, and the tab closes

#### Scenario: Unassigned until bound

- **WHEN** the extension is installed and the user has not assigned a key to the command
- **THEN** the command is listed among the extension's shortcuts with no binding, and no key
  combination triggers an archive

#### Scenario: Popup selection is irrelevant

- **WHEN** three tabs are selected in the popup and the user triggers the browser-level command
- **THEN** only the active tab of the focused window is archived

#### Scenario: Auto-archive properties not applied

- **WHEN** an auto-archive property set is configured and the user triggers the command
- **THEN** the created page carries the always-on fixed properties only

### Requirement: Feedback for archives triggered outside the popup

Because the browser-level command can run with no extension UI open, the system SHALL report each
outcome through a transient indicator on the toolbar action badge — one state for a completed
archive, a distinct one for a refusal or failure — and SHALL afterwards restore the badge to
whatever the tab-count indicator would otherwise be showing, including when that is nothing.

#### Scenario: Success is visible without any UI open

- **WHEN** the command archives a tab while no popup is open
- **THEN** the toolbar badge briefly indicates success and then returns to its prior content

#### Scenario: Failure is distinguishable from success

- **WHEN** the command refuses or fails to archive
- **THEN** the toolbar badge briefly shows the failure state, distinct from the success state

#### Scenario: Badge ownership returns

- **WHEN** the transient indicator has elapsed and the tab-count indicator setting is enabled
- **THEN** the badge again shows the tab count, not a stale archive indicator

## MODIFIED Requirements

### Requirement: Staleness rules do not gate the immediate archive

Because the user chose the tab explicitly, the immediate archive paths — the popup shortcut over
the selected or focused tabs, and the browser-level command over the active tab — SHALL ignore the
staleness threshold, the pinned and grouped exclusion settings, and journal dedup. They SHALL
still refuse tabs whose resolved URL is not http(s) and tabs whose resolved URL matches the domain
exclusion list, and SHALL refuse every tab when no Notion token or target is configured. A refused
tab SHALL be left open and reported as skipped rather than failing the run. Domain exclusion is a
"never archive this" rule and therefore applies to every archive path.

#### Scenario: Fresh, pinned, grouped, or already-archived tab

- **WHEN** the user selects a tab that is brand new, pinned, in a tab group, or whose URL was
  archived recently, and triggers the shortcut
- **THEN** the tab is archived and closed anyway

#### Scenario: Non-archivable URL selected

- **WHEN** the selection includes a `chrome://` or other non-http(s) tab
- **THEN** that tab is left open and reported as skipped, while the remaining selected tabs are
  archived normally

#### Scenario: Excluded domain selected

- **WHEN** the selection includes a tab on a domain in the exclusion list
- **THEN** that tab is left open and reported as skipped, while the remaining selected tabs are
  archived normally

#### Scenario: Browser-level command on a refused tab

- **WHEN** the user triggers the browser-level command on a `chrome://` page, on a tab whose
  domain is excluded, or with no token or target configured
- **THEN** nothing is archived, the tab stays open, and the refusal is reported through the
  toolbar badge

#### Scenario: Browser-level command on a fresh tab

- **WHEN** the user triggers the browser-level command on a page opened seconds ago
- **THEN** it is archived and closed, staleness notwithstanding
