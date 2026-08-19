# notion-connection Specification

## Purpose

Authenticates to Notion with an internal-integration token, resolves the target database/data
source and its Title/URL property mapping, and enforces where the token and connection state may
live.

## Requirements

### Requirement: Token storage and isolation

The system SHALL store the Notion internal-integration token exclusively in
`chrome.storage.local` (never `chrome.storage.sync`), and the token SHALL only be read by
service-worker code paths. All Notion network requests SHALL originate from the MV3 service
worker; the popup/UI context SHALL never hold the token or call the Notion API directly.

#### Scenario: Token saved from settings

- **WHEN** the user pastes a token into settings and saves
- **THEN** the token is written to `chrome.storage.local` and does not appear in any
  `storage.sync` key

#### Scenario: UI needs Notion data

- **WHEN** the settings UI needs to search databases or verify the token
- **THEN** it sends a runtime message to the service worker, which performs the request and
  returns only non-secret results

### Requirement: Token verification

The system SHALL provide a token verification action (`GET /v1/users/me`) that reports success
(with the integration/bot name) or a typed error: 401 → invalid token, network failure → typed
network error.

#### Scenario: Valid token verified

- **WHEN** the user clicks "Verify" with a valid token configured
- **THEN** the settings UI shows the connected integration name

#### Scenario: Invalid token

- **WHEN** the user clicks "Verify" with a revoked or malformed token
- **THEN** the settings UI shows an "invalid token" error and archive features remain disabled

### Requirement: Target database selection and resolution

The system SHALL let the user pick the archive target from the databases/data sources shared with
the integration (via the Notion search API), and SHALL resolve and persist an `ArchiveTarget`
containing database id, data source id, display title, and property mapping. Response-shape
knowledge under the pinned `Notion-Version` SHALL be confined to a single resolver function.

#### Scenario: Picking a shared database

- **WHEN** the user types in the DB picker
- **THEN** matching databases/data sources shared with the integration are listed, and selecting
  one persists the resolved `ArchiveTarget` to `chrome.storage.local`

#### Scenario: Database not shared with the integration

- **WHEN** a Notion request fails with 404 for the selected target
- **THEN** the error is surfaced as "database not shared with the integration"

### Requirement: Property mapping by type

The system SHALL map page properties by property type, not name: the title property is the
unique `type: "title"` property; the URL property is the first `type: "url"` property (name match
`/url|link/i` as tie-break). When no URL property exists, the mapping SHALL record `urlPropName =
null` and the page URL is conveyed via a bookmark block only.

#### Scenario: DB with a url property

- **WHEN** the selected DB has properties `Name` (title) and `Link` (url)
- **THEN** the mapping resolves titlePropName = "Name", urlPropName = "Link"

#### Scenario: DB without a url property

- **WHEN** the selected DB has only a title property
- **THEN** the mapping resolves urlPropName = null and archiving still succeeds

### Requirement: Rate limiting and retry

The Notion client SHALL serialize requests with ~350 ms spacing (≈3 requests/second), honor
`Retry-After` on HTTP 429 with at most 2 retries, and return typed results instead of throwing
raw errors.

#### Scenario: Rate-limited request

- **WHEN** the Notion API responds 429 with a Retry-After header
- **THEN** the client waits the indicated time and retries, up to 2 times, before reporting a
  typed error
