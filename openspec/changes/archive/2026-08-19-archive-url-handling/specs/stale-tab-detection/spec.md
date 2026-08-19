# stale-tab-detection

## ADDED Requirements

### Requirement: Effective URL resolution

When the "extract URL" compatibility setting is on (default), the system SHALL resolve a tab whose
URL is an extension placeholder carrying a real http(s) URL in its query string or hash fragment
to that real URL, and use the resolved URL for every URL-dependent decision: http(s) eligibility,
domain exclusion, and journal dedup. Detection SHALL be generic across suspender extensions, not
tied to a specific extension id. When the setting is off, the placeholder URL is used as-is and
the tab is therefore excluded as a non-http(s) URL.

#### Scenario: Parked tab becomes eligible

- **WHEN** a tab's URL is `chrome-extension://<id>/park.html?title=X&url=https%3A%2F%2Fexample.com%2Fa`
  and the setting is on
- **THEN** the tab is treated as `https://example.com/a` and is eligible for archiving

#### Scenario: Extraction disabled

- **WHEN** the same tab is evaluated with the setting off
- **THEN** the tab is excluded, because its URL is not http(s)

#### Scenario: Placeholder without a recoverable URL

- **WHEN** a tab's URL is an extension page with no parameter holding an http(s) URL
- **THEN** no resolution occurs and the tab remains excluded

#### Scenario: Dedup uses the resolved URL

- **WHEN** a parked tab resolves to a URL already archived within the dedup window
- **THEN** the tab is not proposed again

### Requirement: Domain exclusion list

The system SHALL let the user list domains that are never archived. A tab is excluded when its
resolved URL's hostname equals a listed domain or is a subdomain of it, compared
case-insensitively. Entries SHALL be normalized so a pasted URL or a leading `www.` still yields a
usable hostname, and blank lines are ignored. An empty list excludes nothing.

#### Scenario: Subdomain covered by a parent entry

- **WHEN** the list contains `notion.com` and a stale tab is on `app.notion.com`
- **THEN** the tab is not proposed and is never auto-archived

#### Scenario: Unrelated domain not matched

- **WHEN** the list contains `notion.com` and a stale tab is on `notionary.example.com`
- **THEN** the tab is proposed normally

#### Scenario: Forgiving entry format

- **WHEN** the user types `https://app.notion.com/page` or `www.notion.com` as an entry
- **THEN** it is treated as the hostname `app.notion.com` / `notion.com` respectively
