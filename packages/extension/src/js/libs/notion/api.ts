// High-level Notion operations for the tab-archive feature (SW-only).
// `resolveTarget` is the ONLY code that knows the Notion response shape under
// the pinned NOTION_VERSION (spec: notion-connection — single resolver).

import { notionRequest } from './client'
import {
  ArchiveTarget,
  FixedProperty,
  Result,
  TargetProperty,
  TargetPropertyOption,
  err,
  isFixedPropertyType,
  ok,
  passErr,
} from './types'

const URL_NAME_TIEBREAK = /url|link/i

interface RichTextItem {
  plain_text?: string
}

/** A raw Notion property definition. Options for select-like types live under
 * a key named after the type itself, e.g. `{type:"select", select:{options}}`. */
interface RawProperty {
  type?: string
  [key: string]: unknown
}

interface DataSourceObject {
  object?: string
  id?: string
  title?: RichTextItem[]
  parent?: { type?: string; database_id?: string }
  properties?: Record<string, RawProperty>
}

/** Pull `{options}` out of a select/status/multi_select property definition. */
const readOptions = (
  property: RawProperty,
): TargetPropertyOption[] | undefined => {
  const type = property.type
  if (!type) {
    return undefined
  }
  const detail = property[type] as
    | { options?: TargetPropertyOption[] }
    | undefined
  if (!detail || !Array.isArray(detail.options)) {
    return undefined
  }
  return detail.options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
  }))
}

const plainText = (richText: RichTextItem[] | undefined): string =>
  (richText || []).map((item) => item.plain_text || '').join('')

/**
 * Resolve a raw `data_source` object (from /search or /data_sources/{id})
 * into an ArchiveTarget, mapping properties by TYPE, not name:
 * - title  = the unique `type: "title"` property
 * - url    = first `type: "url"` property, tie-broken by /url|link/i, else null
 * Returns null when the object is not a usable data source.
 */
export const resolveTarget = (raw: unknown): ArchiveTarget | null => {
  const dataSource = raw as DataSourceObject
  if (!dataSource || dataSource.object !== 'data_source' || !dataSource.id) {
    return null
  }
  const properties = dataSource.properties || {}
  const names = Object.keys(properties)
  const titlePropName = names.find((name) => properties[name]?.type === 'title')
  if (!titlePropName) {
    return null
  }
  const urlPropNames = names.filter((name) => properties[name]?.type === 'url')
  const urlPropName =
    urlPropNames.find((name) => URL_NAME_TIEBREAK.test(name)) ||
    urlPropNames[0] ||
    null
  return {
    databaseId: dataSource.parent?.database_id || '',
    dataSourceId: dataSource.id,
    title: plainText(dataSource.title) || 'Untitled',
    titlePropName,
    urlPropName,
    properties: names.map((name) => ({
      name,
      type: properties[name]?.type || 'unknown',
      options: readOptions(properties[name] || {}),
    })),
  }
}

/**
 * Encode one configured fixed property into its Notion page-property payload.
 * Returns null for an unsupported type (never sent, reported as a warning).
 */
export const encodeFixedProperty = (property: FixedProperty): unknown => {
  const { type, value } = property
  switch (type) {
    case 'select':
      return { select: { name: String(value) } }
    case 'status':
      return { status: { name: String(value) } }
    case 'multi_select':
      return {
        multi_select: (Array.isArray(value) ? value : [value])
          .filter((entry) => entry !== '' && entry !== null)
          .map((entry) => ({ name: String(entry) })),
      }
    case 'checkbox':
      return { checkbox: Boolean(value) }
    case 'number':
      return { number: Number(value) }
    case 'rich_text':
      return { rich_text: [{ text: { content: String(value) } }] }
    default:
      return null
  }
}

/**
 * Validate configured fixed properties against a FRESH schema (spec:
 * tab-archiving — schema drift is caught before the request, per-property).
 * Returns the encodable subset plus a warning per dropped property.
 */
export const reconcileFixedProperties = (
  fixedProperties: FixedProperty[] | undefined,
  schema: TargetProperty[] | undefined,
): { properties: Record<string, unknown>; warnings: string[] } => {
  const result: { properties: Record<string, unknown>; warnings: string[] } = {
    properties: {},
    warnings: [],
  }
  if (!fixedProperties || !fixedProperties.length) {
    return result
  }
  const byName = new Map((schema || []).map((entry) => [entry.name, entry]))
  for (const property of fixedProperties) {
    const live = byName.get(property.name)
    if (!live) {
      result.warnings.push(
        `Property "${property.name}" no longer exists on the database — skipped`,
      )
      continue
    }
    if (live.type !== property.type) {
      result.warnings.push(
        `Property "${property.name}" changed type (${property.type} → ${live.type}) — skipped`,
      )
      continue
    }
    if (!isFixedPropertyType(live.type)) {
      result.warnings.push(
        `Property "${property.name}" has unsupported type ${live.type} — skipped`,
      )
      continue
    }
    const encoded = encodeFixedProperty(property)
    if (encoded === null) {
      result.warnings.push(
        `Property "${property.name}" could not be encoded — skipped`,
      )
      continue
    }
    result.properties[property.name] = encoded
  }
  return result
}

/** Verify a token via GET /v1/users/me; returns the integration/bot name. */
export const testToken = async (
  token: string,
): Promise<Result<{ botName: string }>> => {
  const result = await notionRequest<{ name?: string }>(
    token,
    'GET',
    '/users/me',
  )
  if (!result.ok) {
    return passErr(result)
  }
  return ok({ botName: result.value.name || 'Notion integration' })
}

/** Search data sources shared with the integration, resolved to targets. */
export const searchTargets = async (
  token: string,
  query: string,
): Promise<Result<ArchiveTarget[]>> => {
  const result = await notionRequest<{ results?: unknown[] }>(
    token,
    'POST',
    '/search',
    {
      query: query || undefined,
      filter: { property: 'object', value: 'data_source' },
      page_size: 20,
    },
  )
  if (!result.ok) {
    return passErr(result)
  }
  const targets = (result.value.results || [])
    .map(resolveTarget)
    .filter((target): target is ArchiveTarget => target !== null)
  return ok(targets)
}

/** Re-resolve a target by data source id (fresh property mapping). */
export const resolveTargetById = async (
  token: string,
  dataSourceId: string,
): Promise<Result<ArchiveTarget>> => {
  const result = await notionRequest(
    token,
    'GET',
    `/data_sources/${dataSourceId}`,
  )
  if (!result.ok) {
    return passErr(result)
  }
  const target = resolveTarget(result.value)
  if (!target) {
    return err('api', 'Selected data source has no title property')
  }
  return ok(target)
}

/**
 * Create one archive page: title property, url property when mapped, and a
 * bookmark block ALWAYS (spec: tab-archiving — simple page content, nothing else).
 */
export const createArchivePage = async (
  token: string,
  target: ArchiveTarget,
  tab: { title: string; url: string },
  extraProperties?: Record<string, unknown>,
  extraBlocks?: unknown[],
): Promise<Result<{ pageId: string }>> => {
  const properties: Record<string, unknown> = {
    // Configured fixed properties first, so the title/URL mapping always wins
    // if a user somehow pinned a value onto the title or URL property itself.
    ...(extraProperties || {}),
    [target.titlePropName]: {
      title: [{ text: { content: tab.title || tab.url } }],
    },
  }
  if (target.urlPropName) {
    properties[target.urlPropName] = { url: tab.url }
  }
  const result = await notionRequest<{ id?: string }>(token, 'POST', '/pages', {
    parent: { type: 'data_source_id', data_source_id: target.dataSourceId },
    properties,
    children: [
      { object: 'block', type: 'bookmark', bookmark: { url: tab.url } },
      ...(extraBlocks || []),
    ],
  })
  if (!result.ok) {
    return passErr(result)
  }
  if (!result.value.id) {
    return err('api', 'Notion page created without an id')
  }
  return ok({ pageId: result.value.id })
}
