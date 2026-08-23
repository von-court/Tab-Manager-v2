// Shared types for the Notion tab-archive feature.
// Specs: openspec/specs/{notion-connection,tab-archiving,archive-settings}/spec.md
//
// Shapes frozen empirically against `Notion-Version: 2025-09-03` (2026-07-15):
// - `POST /v1/search` with `filter: {property: "object", value: "data_source"}`
//   returns `data_source` objects with inline typed `properties`, a rich-text
//   `title` array, and `parent: {type: "database_id", database_id}`.
// - `GET /v1/data_sources/{id}` returns the same shape.
// - `POST /v1/pages` accepts `parent: {type: "data_source_id", data_source_id}`,
//   properties keyed by name, and bookmark `children` blocks.

/** Property types the fixed-properties editor supports (spec: archive-settings).
 * Everything else (people, relation, files, formula, rollup, …) is deliberately
 * not offered — see design.md Non-Goals. */
export const FIXED_PROPERTY_TYPES = [
  'select',
  'status',
  'multi_select',
  'checkbox',
  'number',
  'rich_text',
] as const

export type FixedPropertyType = (typeof FIXED_PROPERTY_TYPES)[number]

export const isFixedPropertyType = (type: string): boolean =>
  (FIXED_PROPERTY_TYPES as readonly string[]).includes(type)

/** One selectable option of a select/status/multi_select property. */
export interface TargetPropertyOption {
  id?: string
  name: string
  color?: string
}

/** One property of the target data source, as surfaced to the settings editor
 * so the user picks real names/types instead of free-typing. */
export interface TargetProperty {
  name: string
  type: string
  /** Present for select/status/multi_select. */
  options?: TargetPropertyOption[]
}

/** A static value applied to EVERY archived page (spec: tab-archiving).
 * `value` shape follows `type`: string for select/status/rich_text, string[]
 * for multi_select, boolean for checkbox, number for number. */
export interface FixedProperty {
  name: string
  type: FixedPropertyType
  value: string | string[] | boolean | number
}

/** The persisted archive destination, resolved once at selection time. */
export interface ArchiveTarget {
  databaseId: string
  dataSourceId: string
  /** Plain-text display title of the data source. */
  title: string
  /** Name of the unique `type: "title"` property. */
  titlePropName: string
  /** Name of the mapped `type: "url"` property, or null when the schema has
   * none (page URL then only lands in the bookmark block). */
  urlPropName: string | null
  /** Full property list of the data source, refreshed on every resolve.
   * Drives the fixed-properties editor. */
  properties?: TargetProperty[]
  /** User-configured static properties set on every archived page. Absent on
   * targets configured before this feature existed (not backfilled). */
  fixedProperties?: FixedProperty[]
  /** Static properties set ONLY on pages created by an unattended auto-archive
   * run, merged over `fixedProperties` (spec: tab-archiving — auto-archive-only
   * properties). Absent means none. */
  autoFixedProperties?: FixedProperty[]
}

/** One archive-journal record, written to storage.local *before* the tab is
 * closed (journal-before-close invariant). Pruned oldest-first to 500. */
export interface ArchiveJournalEntry {
  url: string
  title: string
  pageId: string
  /** ms since epoch */
  archivedAt: number
  /** true when created by the unattended auto-archive run */
  auto: boolean
}

export type NotionErrorKind =
  | 'invalid-token' // HTTP 401
  | 'not-shared' // HTTP 404 — object not shared with the integration
  | 'rate-limited' // HTTP 429 after retries exhausted
  | 'network' // fetch itself failed
  | 'api' // any other non-2xx Notion error

export interface NotionError {
  kind: NotionErrorKind
  message: string
  status?: number
}

// NOTE: deliberately NOT a discriminated union — this repo compiles without
// `strictNullChecks`, and TS does not narrow `{ok: true, ...} | {ok: false, ...}`
// unions in that mode. Invariant: `ok: true` ⇒ `value` set; `ok: false` ⇒ `error` set.
export interface Result<T> {
  ok: boolean
  value?: T
  error?: NotionError
}

export const err = (
  kind: NotionErrorKind,
  message: string,
  status?: number,
): Result<never> => ({
  ok: false,
  error: { kind, message, status },
})

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

/** Re-wrap a failed Result under a different value type. */
export const passErr = <T>(failed: Result<unknown>): Result<T> => ({
  ok: false,
  error: failed.error,
})

/** Minimal tab payload the popup sends to the service worker for archiving. */
export interface ArchiveTabInput {
  tabId: number
  title: string
  /** Resolved URL — the real page, even when the tab shows a suspender
   * placeholder (spec: stale-tab-detection — effective URL resolution). */
  url: string
  /** True when url/title were recovered from a placeholder; such a tab's DOM
   * is the placeholder, so page-content capture is skipped. */
  recovered?: boolean
}

/** Per-tab outcome of an archive run, reported back to the review dialog. */
export interface ArchiveResult {
  tabId: number
  url: string
  title: string
  ok: boolean
  pageId?: string
  error?: string
  /** Non-blocking enrichment problems (dropped fixed property, skipped content
   * capture). The tab is still archived and closed (spec: tab-archiving —
   * "Enrichment-only failure does not block archive"). */
  warnings?: string[]
}
