# tab-archiving

## MODIFIED Requirements

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

## ADDED Requirements

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
