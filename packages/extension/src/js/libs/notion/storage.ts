// Typed chrome.storage.LOCAL accessors for the Notion tab-archive feature.
//
// SECURITY INVARIANT (spec: notion-connection, archive-settings): the token,
// archive target, and journal live ONLY in storage.local — never in
// storage.sync and never in UserStore DEFAULT_SETTINGS (which auto-syncs).

import { browser } from 'libs'
import {
  ArchiveJournalEntry,
  ArchiveTarget,
  FixedProperty,
  TargetProperty,
} from './types'

export const TOKEN_KEY = 'notionToken'
export const TARGET_KEY = 'notionArchiveTarget'
export const JOURNAL_KEY = 'notionArchiveJournal'
// Non-secret connection status (bot name + verify time). Written by the SW on
// a successful token verify; the popup reads THIS instead of the token key.
export const CONNECTION_KEY = 'notionConnection'

/** Journal is pruned oldest-first to this many entries (spec: tab-archiving). */
export const JOURNAL_MAX_ENTRIES = 500

export const getNotionToken = async (): Promise<string | null> => {
  const data = await browser.storage.local.get({ [TOKEN_KEY]: null })
  return data[TOKEN_KEY] || null
}

export const setNotionToken = async (token: string | null): Promise<void> => {
  if (token) {
    await browser.storage.local.set({ [TOKEN_KEY]: token })
  } else {
    await browser.storage.local.remove(TOKEN_KEY)
  }
}

export interface NotionConnection {
  botName: string
  verifiedAt: number
}

export const getNotionConnection =
  async (): Promise<NotionConnection | null> => {
    const data = await browser.storage.local.get({ [CONNECTION_KEY]: null })
    return data[CONNECTION_KEY] || null
  }

export const setNotionConnection = async (
  connection: NotionConnection | null,
): Promise<void> => {
  if (connection) {
    await browser.storage.local.set({ [CONNECTION_KEY]: connection })
  } else {
    await browser.storage.local.remove(CONNECTION_KEY)
  }
}

/**
 * Coerce a value that should be an array back into one. Targets written by a
 * build that persisted a MobX observable array land in storage as a
 * numeric-keyed object ({"0": …}); heal those instead of throwing on .filter.
 */
const asArray = <T>(value: unknown): T[] | undefined => {
  if (Array.isArray(value)) {
    return value as T[]
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, T>)
  }
  return undefined
}

export const getArchiveTarget = async (): Promise<ArchiveTarget | null> => {
  const data = await browser.storage.local.get({ [TARGET_KEY]: null })
  const target = data[TARGET_KEY] as ArchiveTarget | null
  if (!target) {
    return null
  }
  const properties = asArray<TargetProperty>(target.properties)
  return {
    ...target,
    // Heal the nested per-property `options` arrays too, not just the outer one.
    properties: properties?.map((property) => ({
      ...property,
      options: asArray(property?.options),
    })),
    fixedProperties: asArray<FixedProperty>(target.fixedProperties)?.map(
      (property) =>
        property?.type === 'multi_select'
          ? { ...property, value: asArray<string>(property.value) || [] }
          : property,
    ),
  }
}

export const setArchiveTarget = async (
  target: ArchiveTarget | null,
): Promise<void> => {
  if (target) {
    await browser.storage.local.set({ [TARGET_KEY]: target })
  } else {
    await browser.storage.local.remove(TARGET_KEY)
  }
}

export const getArchiveJournal = async (): Promise<ArchiveJournalEntry[]> => {
  const data = await browser.storage.local.get({ [JOURNAL_KEY]: [] })
  return data[JOURNAL_KEY] || []
}

/** Append one entry and prune oldest-first to JOURNAL_MAX_ENTRIES. */
export const appendArchiveJournalEntry = async (
  entry: ArchiveJournalEntry,
): Promise<void> => {
  const journal = await getArchiveJournal()
  journal.push(entry)
  await browser.storage.local.set({
    [JOURNAL_KEY]: journal.slice(-JOURNAL_MAX_ENTRIES),
  })
}
