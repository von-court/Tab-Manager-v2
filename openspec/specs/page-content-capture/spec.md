# page-content-capture Specification

## Purpose

Extracts a tab's main text and lead image immediately before it is archived, and turns that into
additional Notion blocks appended to the archived page — always with a safe fallback to
bookmark-only content when extraction isn't possible.

## Requirements

### Requirement: On-demand extraction only when configured

The system SHALL only invoke content extraction when the content-depth setting is
"Bookmark + page content"; when set to "Bookmark only" (default), no script is injected into the
tab and no extraction runs.

#### Scenario: Bookmark-only skips extraction

- **WHEN** content depth is "Bookmark only"
- **THEN** no content script runs and the archived page contains only the existing bookmark-only
  content

#### Scenario: Extraction permission scoped to the archived tab

- **WHEN** content depth is set to "Bookmark + page content" and a tab is being archived
- **THEN** the extraction script runs only in that specific tab, only as part of that archive
  operation, using the `scripting` permission

### Requirement: Main text and lead image extraction

When content depth requires it, the system SHALL extract the tab's main readable text and, on a
best-effort basis, its first significant image, from the tab's live rendered DOM immediately
before archiving.

#### Scenario: Successful extraction

- **WHEN** content depth is "Bookmark + page content" and the tab is a normal, scriptable http(s)
  page
- **THEN** the tab's main text and first significant image (if any) are extracted and appended as
  blocks to the archived Notion page, after the bookmark block

#### Scenario: No usable image

- **WHEN** no image on the page qualifies as a directly-linkable image (e.g. only relative,
  `blob:`, or otherwise unusable sources)
- **THEN** the page is still created with extracted text blocks and no image block; this is not
  treated as a failure

### Requirement: Text chunking within Notion limits

Extracted text SHALL be split into multiple paragraph blocks so that no single block's rich-text
content exceeds Notion's per-block character limit, preserving reading order.

#### Scenario: Long article chunking

- **WHEN** extracted text exceeds the limit for a single rich-text block
- **THEN** the text is split across multiple paragraph blocks, each within the limit, appended in
  original reading order

### Requirement: Bookmark-only fallback on failure

Any extraction failure — an unscriptable tab, a timed-out or erroring content script, or a page
with no extractable main content — SHALL fall back to bookmark-only content for that page rather
than failing or delaying the archive.

#### Scenario: Unscriptable tab

- **WHEN** the tab's URL cannot be scripted (e.g. `chrome://`, a PDF viewer, or another
  extension's page)
- **THEN** extraction is skipped and the page falls back to bookmark-only content without
  surfacing an error

#### Scenario: Extraction timeout or error

- **WHEN** the content script fails to complete within a bounded time budget or throws an error
- **THEN** the page falls back to bookmark-only content and the archive for that tab still
  succeeds

### Requirement: No capture from a placeholder page

The system SHALL NOT attempt content capture for a tab whose URL was recovered from an extension
placeholder, because the tab renders the placeholder rather than the real page. Such a tab SHALL
fall back to link-only content with a warning, even when content depth is "Bookmark + page
content".

#### Scenario: Rich depth on a parked tab

- **WHEN** content depth is "Bookmark + page content" and a parked tab is archived
- **THEN** no script is injected, the page is created with link-only content, and the result
  carries a warning explaining the fallback
