# tab-archiving

## MODIFIED Requirements

### Requirement: Simple page content

Created Notion pages SHALL contain the title property (tab title), the URL property when the
mapping has one, a bookmark block with the tab URL, any configured fixed properties (see
`archive-settings`), and, when the content-depth setting is "Bookmark + page content", the
additional blocks produced by `page-content-capture`. The system SHALL NOT attempt to populate
any property beyond the title/URL properties and the user-configured fixed properties; schema
rejections for those surface as per-tab (fixed properties: per-property) errors without blocking
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
