# Design: archive-selected-now

## Context

`StaleTabsStore.archiveCheckedTabs()` already owns the popup side of archiving: it builds the
`ArchiveTabInput[]`, sends `NOTION-ARCHIVE-TABS`, stores per-tab results, refreshes the journal,
and raises the snackbar. The service worker path (fixed properties, content capture,
partial-failure handling) is entirely tab-list driven and knows nothing about staleness.

Selection semantics already exist: `tabStore.sources` is the ordered selection, and
`FocusStore.createGroupFromFocusedOrSelectedTabs` establishes the "selected, else focused"
precedent this feature should mirror rather than invent.

## Goals / Non-Goals

**Goals:**

- One keystroke from "looking at a tab" to "it is in Notion and gone".
- Reuse the existing archive pipeline verbatim so the two entry points cannot drift.

**Non-Goals:**

- A confirmation step or any new UI surface.
- Making staleness configurable per-invocation — this path simply does not consult it.

## Decisions

1. **Extract the send/report half of `archiveCheckedTabs` into a shared private method** rather
   than duplicating it. Both entry points then differ only in how they choose tabs, which keeps
   snackbar wording, result recording, and journal refresh identical by construction.

2. **"Selected, else focused"**, mirroring `createGroupFromFocusedOrSelectedTabs` — deduped by
   tab id and ordered by the existing `tabStore.sources` ordering. Matching an established
   in-repo pattern beats a new selection rule the user would have to learn.

3. **Filter only on URL scheme.** Staleness, exclusions, and dedup are skipped by design (the
   user pointed at these tabs). Non-http(s) tabs cannot become a Notion page with a working
   bookmark, so they are dropped before the message and surfaced in the snackbar as skipped —
   never silently, since the tab visibly stays open.

4. **Reuse `shift+a`'s neighbourhood: `shift+ctrl+a`.** Matches the repo's existing
   `shift+ctrl+<key>` ordering convention, and pairs mnemonically with the review dialog. The
   command palette entry is free — it is derived from `ShortcutStore.shortcuts`.

## Risks / Trade-offs

- [No confirmation on a destructive-feeling action] → the tab is recoverable: the Notion page is
  created before the close, and the journal keeps `{url, title, pageId}`. A failed page create
  never closes its tab.
- [Dedup bypass can create a duplicate Notion page for a URL archived earlier] → intended; an
  explicit re-archive is a deliberate act, and the journal still records both.
