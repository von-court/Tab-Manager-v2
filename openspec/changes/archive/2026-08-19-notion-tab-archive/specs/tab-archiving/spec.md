# tab-archiving

## ADDED Requirements

### Requirement: Review dialog for proposed tabs

The system SHALL present stale tabs in a review dialog (favicon, title, domain, idle age) with
per-tab checkboxes (all checked by default) and a confirm action labeled with the number of tabs
to archive. The dialog SHALL be reachable via a toolbar button, a keyboard shortcut, and the
command palette. The toolbar button SHALL render only when a Notion connection is configured.

#### Scenario: Opening the review dialog

- **WHEN** the user clicks the archive toolbar button with 4 stale tabs detected
- **THEN** a dialog lists the 4 tabs with checkboxes checked and a "Archive 4 tabs to Notion"
  confirm action

#### Scenario: Unconfigured Notion

- **WHEN** no Notion token or target is configured
- **THEN** the archive toolbar button is not rendered

### Requirement: Archive execution

On confirm, the system SHALL, for each selected tab sequentially: create a Notion page in the
configured target (title = tab title, URL per property mapping, plus a bookmark block with the
URL), append a journal entry, and only then close the tab. Per confirmation, at most 25 tabs
SHALL be processed.

#### Scenario: Successful archive

- **WHEN** the user confirms 3 selected tabs and all Notion page creations succeed
- **THEN** 3 pages exist in the target DB, 3 journal entries are appended, and the 3 tabs are
  closed

#### Scenario: Journal precedes close

- **WHEN** a Notion page has been created for a tab
- **THEN** the journal entry is persisted before the tab is closed, so a crash cannot lose the
  record of an archived page

### Requirement: Partial-failure handling

The system SHALL never close a tab whose Notion page creation failed. Failures SHALL be reported
per tab in the dialog (with error text) and summarized via snackbar; successful tabs in the same
batch proceed normally.

#### Scenario: Mixed results

- **WHEN** 7 tabs are confirmed and 2 page creations fail
- **THEN** 5 tabs are archived and closed, the 2 failed tabs stay open and are listed with their
  errors, and a snackbar reports "Archived 5 tabs to Notion (2 failed)"

### Requirement: Simple page content

Created Notion pages SHALL contain only: the title property (tab title), the URL property when
the mapping has one, and a bookmark block with the tab URL. The system SHALL NOT attempt to
populate any other properties; schema rejections surface as per-tab errors.

#### Scenario: Page shape

- **WHEN** a tab titled "Interesting article" with URL https://example.com/a is archived
- **THEN** the created page has title "Interesting article", the URL property (if mapped) set to
  the URL, a bookmark block pointing at the URL, and nothing else

### Requirement: Archive journal

The system SHALL maintain an archive journal in `chrome.storage.local` with entries
`{url, title, pageId, archivedAt, auto}`, pruned oldest-first to 500 entries.

#### Scenario: Journal pruning

- **WHEN** the journal reaches 500 entries and a new tab is archived
- **THEN** the oldest entry is removed and the new entry appended
