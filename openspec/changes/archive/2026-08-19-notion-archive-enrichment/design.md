# Design: notion-archive-enrichment

## Context

Builds on the archived `notion-tab-archive` feature (see `openspec/specs/{stale-tab-detection,
notion-connection,tab-archiving,archive-settings}/spec.md`). Today: `libs/staleness.ts` hardcodes
pinned/active/audible/non-http(s) exclusion and has no concept of tab groups; `createArchivePage`
in `libs/notion/api.ts` sets exactly the title property, the URL property (if mapped), and a
bookmark block — nothing else, by design ("Non-Goal: enriching Notion pages beyond Title + URL");
the manifest declares only `tabs`, `alarms`, and `host_permissions: ["https://api.notion.com/*"]`
— no broad web-page host access and no `scripting` permission.

## Goals / Non-Goals

**Goals:**

- Make pinned/grouped exclusion user-controlled, defaulting to today's exact behavior.
- Let the user pin a small set of static property values (e.g. `Tags = "webpage"`) onto every
  archived page, chosen from the target DB's real schema.
- Let the user opt into richer page content (main text + lead image) instead of bookmark-only,
  with extraction that never blocks or fails an archive.
- Request the new, more sensitive permission (broad page access for content scripting) only when
  the user actually opts into content capture — not at install time.

**Non-Goals:**

- Arbitrary per-property mapping logic (per-tab computed values, templates, formulas) — fixed
  properties are one static value applied identically to every archived page.
- Supporting every Notion property type for fixed properties — v1 covers `select`, `status`,
  `multi_select`, `checkbox`, `number`, and `rich_text`. `people`, `relation`, `files`, `formula`,
  and `rollup` are not offered in the picker (attempting one anyway surfaces as the existing
  per-property schema-rejection error).
- True "reader mode" content extraction (Readability-grade parsing, paywall handling, multi-image
  galleries) — v1 uses a pragmatic heuristic, not a research-grade content extractor.
- Uploading images to Notion-hosted storage — only images already reachable at a stable http(s)
  URL become image blocks.

## Decisions

1. **Exclusion settings are two independent booleans threaded into `isStaleTab`'s options**
   (`excludePinnedTabs`, `excludeGroupedTabs`, both default `true`), read the same way
   `thresholdMs`/`journalUrls` already are. `libs/staleness.ts` stays a pure function; no new
   concept, just two more caller-supplied flags. `StalenessTab` gains an optional `groupId` field
   (already present on raw `chrome.tabs.Tab`, needs adding to the popup's `stores/Tab.tsx`
   mirror). A grouped tab is `groupId !== -1` (`chrome.tabGroups.TAB_GROUP_ID_NONE`).

2. **Fixed properties are typed, not free-text.** Stored as
   `FixedProperty[] = { name, type, value }[]` alongside `ArchiveTarget` in
   `chrome.storage.local` (same doc, new field — not a separate storage key, since the mapping is
   meaningless without its target and should be reset when the target changes). The settings
   editor's property dropdown is populated from the _same_ property list already fetched by
   `resolveTargetById` (extend the resolver to also return the raw typed property list, not just
   the title/url pick), filtered to the six supported types. The value input adapts per type:
   `select`/`status` → dropdown of that property's real options; `multi_select` → multi-pick of
   real options; `checkbox` → toggle; `number`/`rich_text` → text input. This directly reuses data
   already on the wire — no extra Notion request. Alternative considered: a free-text property
   name plus a JSON value (rejected — invites schema/type mismatches with no validation, and is a
   worse editing experience for the one real use case: "set Tags to webpage").

   **Refinement (found during implementation):** the driving case is `Tags` — a `multi_select`
   with 56 existing options — set to `"webpage"`, a value that does **not** exist yet. An
   existing-options-only picker would make the primary use case impossible. Notion auto-creates a
   missing option on write for `select` and `multi_select`, but **not** for `status` (its options
   are fixed by the database). So the value control for `select`/`multi_select` is a combo: pick
   an existing option **or** type a new one, with an explicit hint that a new value will be
   created in Notion on first archive. `status` stays existing-options-only, since inventing an
   option there just errors.

3. **`createArchivePage` accepts an optional `extraProperties` array**, applied via the same
   `Record<string, unknown>` properties object as title/URL, Notion-API-encoded per stored
   `type`. Per-property failures are caught individually (build the properties object entry by
   entry against a locally-cached copy of the schema fetched at archive time — not a stale one
   from settings — so a renamed/deleted property is detected before the request, not as an
   opaque 400) and reported as a warning on that tab's result rather than failing the whole page.
   Alternative considered: let a bad property 400 the whole `POST /v1/pages` call and treat it as
   a full tab failure (rejected — one stale property definition would silently block archiving
   entirely until the user notices and fixes settings; per-property is friendlier and matches the
   existing "partial failure never blocks the batch" philosophy).

4. **Content capture runs as an injected function via `chrome.scripting.executeScript`
   (`func`, not `files`)**, called from the service worker immediately before `createArchivePage`
   for that tab, with a bounded timeout (5 s) raced via `Promise.race`. Extraction heuristic:
   prefer `document.querySelector('article, main')?.innerText`, fall back to
   `document.body.innerText`, trimmed and whitespace-normalized; lead image = the largest `<img>`
   by `naturalWidth * naturalHeight` above a minimum size (200×200) whose `src` resolves to an
   absolute `http(s)` URL (skips `data:`/`blob:`/relative-but-unresolvable and tracking pixels).
   Returns `{ text: string | null, imageUrl: string | null }` or throws/times out → caller treats
   any non-success as "no capture" and proceeds bookmark-only.

5. **Text becomes chunked paragraph blocks; a single archive stays one `POST /v1/pages` call.**
   Notion caps a rich-text item's `content` at 2000 characters and a single `children` array at
   100 blocks. Split extracted text into ≤2000-char paragraph blocks; cap total generated blocks
   at 90 (leaving headroom under the bookmark + image blocks) and truncate anything beyond that
   with a trailing "… (truncated)" paragraph rather than issuing follow-up
   `PATCH /v1/blocks/{id}/children` calls, to keep the archive a single atomic create. Truncation
   is silent in the UI (not treated as a failure) — flagged as a risk below.

6. **New permission requested on demand, not declared statically.** Add `scripting` to
   `optional_permissions` and `http://*/*`, `https://*/*` to `optional_host_permissions` in
   `src/manifest-v3.json` (Chrome-only, matching the existing Chrome-only Notion permissions
   pattern). When the user switches content depth to "Bookmark + page content" in settings, the
   UI calls `chrome.permissions.request(...)` inside that same click handler (required — the API
   needs a user gesture). Declining reverts the control to "Bookmark only" and shows why. Runs
   that later find the permission revoked (`chrome.permissions.contains` check at extraction time)
   fall back to bookmark-only for that run rather than erroring. Alternative considered: declare
   `<all_urls>` + `scripting` unconditionally at install (rejected — every existing user would see
   a permission bump on next update just to keep using a feature they never asked for; optional
   permissions keep the default install exactly as sensitive as it is today).

## Risks / Trade-offs

- [Broad host access is a meaningfully bigger privacy surface than today's Notion-only reach] →
  optional, on-demand permission (Decision 6); UI copy in the content-depth control should say
  plainly what it grants before the browser's own prompt appears.
- [`activeTab` can't cover batch-archiving background tabs] → not used; optional broad
  `host_permissions` is the only mechanism that works for tabs that aren't foregrounded, which is
  the common case for stale tabs.
- [Long articles get silently truncated at 90 blocks] → acceptable for a personal 2nd-brain clip
  (the bookmark link always survives regardless); revisit multi-call appends only if this proves
  annoying in practice — open question below.
- [Content-script injection cost on every archived tab when enabled] → bounded 5 s timeout per
  tab, sequential (matches the existing sequential per-tab archive loop, not parallelized) so one
  slow page delays but never hangs a batch; auto-archive's existing per-run cap (default 5) limits
  worst-case run length.
- [Schema drift between "when settings were configured" and "when archiving happens"] → fixed
  properties validated against a fresh schema fetch at archive time (Decision 3), not a cached
  one from when the user configured them.
- [Image block URL going stale or being hotlink-protected] → best-effort only; a failed image
  fetch on Notion's side is a per-page cosmetic gap, not a blocking error — the text and bookmark
  still land.
- [Playwright snapshot churn] → `SettingsDialog.tsx` remains the only touched, snapshot-sensitive
  file; same handling as the original feature (flag, don't regenerate unbidden).

## Migration Plan

Additive only — every new setting defaults to reproducing current behavior exactly, so no
migration step is required for existing installs; `ArchiveTarget` gains an optional
`fixedProperties` field that's simply absent (not backfilled) on already-configured targets until
the user adds one. Land in the same chunk-per-task-group style as the original feature, each
ending with a green `pnpm --filter tab-manager-v2 build:chrome` + manual smoke in Brave. Rollback
= revert the branch; no data migration to undo since nothing existing is restructured.

## Open Questions

- Whether 90 blocks / single-call truncation is generous enough in practice, or whether a follow-
  up `PATCH /v1/blocks/{id}/children` append pass is worth the added complexity — defer until
  real usage shows truncation biting.
- ~~Exact minimum image-size heuristic (200×200 proposed) — tune empirically against a few real
  pages during implementation rather than freezing now.~~ **Resolved during implementation.**
  Measured against real pages (Wikipedia, MDN): stale tabs are _background_ tabs, so lazy-loaded
  `<img>`s never load — Wikipedia had 3 of 58 images loaded, MDN zero — and the few that do load
  are site chrome (logo, wordmark), i.e. exactly the wrong image. So the primary source is now the
  page's declared `og:image` (then `twitter:image`), which needs no image loading, is by
  definition the page's representative image, and is already an absolute URL. The largest-loaded
  `<img>` ≥200×200 remains only as a fallback when no meta image exists.
