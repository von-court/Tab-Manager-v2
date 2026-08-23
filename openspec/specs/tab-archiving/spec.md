# tab-archiving Specification

## Purpose

Converts stale tabs into Notion pages and closes them — the manual review/confirm flow,
partial-failure handling, page content shape, and the archive journal.

## Requirements

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

The system SHALL never close a tab whose core Notion page creation (title/URL/bookmark) failed.
A failure limited to a configured fixed property or to `page-content-capture` extraction SHALL
NOT block the tab's archive or close — the page is created without that property or that extra
content, and the omission is reported alongside the tab's result. Failures SHALL be reported per
tab in the dialog (with error text) and summarized via snackbar; successful tabs in the same
batch proceed normally.

#### Scenario: Mixed results

- **WHEN** 7 tabs are confirmed and 2 core page creations fail
- **THEN** 5 tabs are archived and closed, the 2 failed tabs stay open and are listed with their
  errors, and a snackbar reports "Archived 5 tabs to Notion (2 failed)"

#### Scenario: Enrichment-only failure does not block archive

- **WHEN** a tab's core page is created successfully but its configured fixed property fails to
  apply (schema drift) or its `page-content-capture` extraction fails
- **THEN** the tab is still archived, journaled, and closed, and the partial enrichment failure
  is reported as a warning on that tab's result rather than as a blocking error

### Requirement: Simple page content

Created Notion pages SHALL contain the title property (tab title), the URL property when the
mapping has one, a bookmark block with the tab URL, any configured fixed properties (see
`archive-settings`), any configured auto-archive properties when the page comes from an
unattended run, and, when the content-depth setting is "Bookmark + page content", the
additional blocks produced by `page-content-capture`. The system SHALL NOT attempt to populate
any property beyond the title/URL properties and the user-configured property sets; schema
rejections for those surface as per-tab (properties: per-property) errors without blocking
the rest of the page.

#### Scenario: Page shape

- **WHEN** a tab titled "Interesting article" with URL https://example.com/a is archived with no
  fixed properties configured and content depth set to "Bookmark only" (the defaults)
- **THEN** the created page has title "Interesting article", the URL property (if mapped) set to
  the URL, a bookmark block pointing at the URL, and nothing else

#### Scenario: Fixed properties applied

- **WHEN** a fixed property `Tags = "webpage"` is configured and a tab is archived
- **THEN** the created page's `Tags` property is set to "webpage" in addition to title, URL, and
  the bookmark block

#### Scenario: Fixed property no longer exists (schema drift)

- **WHEN** a configured fixed property name does not exist on the target database at archive time
- **THEN** the page is still created with title/URL/bookmark and any other still-valid fixed
  properties, and the missing property is reported as a per-tab warning without blocking the
  tab's archive

#### Scenario: Content depth beyond bookmark

- **WHEN** content depth is set to "Bookmark + page content" and extraction succeeds
- **THEN** the created page also includes the blocks produced by `page-content-capture`, appended
  after the bookmark block

### Requirement: Auto-archive-only properties

The system SHALL support a second, optional set of static properties that is applied only to
pages created by an unattended auto-archive run, in addition to the always-on fixed properties.
Pages created from the review dialog or the immediate shortcut SHALL NOT receive them. When a
property is configured in both sets, `multi_select` values SHALL be the union of both sets'
values (order preserved, duplicates removed) and every single-valued type SHALL take the
auto-archive value. The set SHALL be reconciled against the live schema and degrade to
per-property warnings exactly like the always-on fixed properties.

#### Scenario: Marking an unattended archive

- **WHEN** `Tags = ["auto-archived-tab"]` is configured as an auto-archive property and the
  scheduled run archives a stale tab
- **THEN** the created page's `Tags` property contains `auto-archived-tab`

#### Scenario: Manual archive stays unmarked

- **WHEN** the same configuration exists and the user archives a tab from the review dialog or
  with the immediate shortcut
- **THEN** the created page carries only the always-on fixed properties, without
  `auto-archived-tab`

#### Scenario: Multi-select union

- **WHEN** `Tags = ["webpage"]` is a fixed property, `Tags = ["auto-archived-tab"]` is an
  auto-archive property, and an unattended run archives a tab
- **THEN** the created page's `Tags` property contains both `webpage` and `auto-archived-tab`

#### Scenario: Single-valued override

- **WHEN** `Status = "Inbox"` is a fixed property, `Status = "Auto"` is an auto-archive property,
  and an unattended run archives a tab
- **THEN** the created page's `Status` property is `Auto`

#### Scenario: Auto-archive property drifted

- **WHEN** an auto-archive property no longer exists on the target database at archive time
- **THEN** the page is still created with title/URL/bookmark and all still-valid properties, and
  the missing property is reported as a warning without blocking the tab's archive

### Requirement: Archive journal

The system SHALL maintain an archive journal in `chrome.storage.local` with entries
`{url, title, pageId, archivedAt, auto}`, pruned oldest-first to 500 entries.

#### Scenario: Journal pruning

- **WHEN** the journal reaches 500 entries and a new tab is archived
- **THEN** the oldest entry is removed and the new entry appended

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
tabs whose resolved URL is not http(s) and tabs whose resolved URL matches the domain exclusion
list, reporting them as skipped rather than failing the run. Domain exclusion is a "never archive
this" rule and therefore applies to every archive path.

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

### Requirement: Archived page uses the resolved identity

When a tab's URL was recovered from a placeholder, the created Notion page SHALL use the resolved
http(s) URL for the URL property and the bookmark block, and SHALL prefer the original page title
carried by the placeholder over the placeholder tab's own title. The journal entry SHALL record
the resolved URL, so dedup and recovery operate on the real page.

#### Scenario: Parked tab archived

- **WHEN** a parked tab resolving to `https://example.com/a` with original title "Example" is
  archived
- **THEN** the Notion page is titled "Example", its URL property and bookmark block point at
  `https://example.com/a`, and the journal records that URL — not the placeholder URL
