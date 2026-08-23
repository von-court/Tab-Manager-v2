## ADDED Requirements

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

## MODIFIED Requirements

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
