# page-content-capture

## ADDED Requirements

### Requirement: No capture from a placeholder page

The system SHALL NOT attempt content capture for a tab whose URL was recovered from an extension
placeholder, because the tab renders the placeholder rather than the real page. Such a tab SHALL
fall back to link-only content with a warning, even when content depth is "Bookmark + page
content".

#### Scenario: Rich depth on a parked tab

- **WHEN** content depth is "Bookmark + page content" and a parked tab is archived
- **THEN** no script is injected, the page is created with link-only content, and the result
  carries a warning explaining the fallback
