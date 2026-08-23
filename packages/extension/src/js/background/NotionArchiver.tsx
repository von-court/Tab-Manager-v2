// Service-worker side of the Notion tab-archive feature.
// Handles the NOTION-* runtime messages (registered via `actionMap`, like
// TabHistory). All Notion network I/O and token reads happen here — the popup
// only exchanges non-secret messages (spec: notion-connection).
//
// Specs: openspec/specs/{notion-connection,tab-archiving,auto-archive,page-content-capture}/spec.md

import actions from 'libs/actions'
import log from 'libs/log'
import { browser } from 'libs'
import { getStaleTabs, recentJournalUrls, resolveTab } from 'libs/staleness'
import { parseExcludedDomains } from 'libs/suspendedTabs'
import {
  CAPTURE_TIMEOUT_MS,
  CapturedContent,
  buildContentBlocks,
  extractPageContent,
} from 'libs/notion/contentCapture'
import {
  ReconciledProperties,
  createArchivePage,
  mergeReconciledProperties,
  reconcileFixedProperties,
  resolveTargetById,
  searchTargets,
  testToken,
} from 'libs/notion/api'
import {
  appendArchiveJournalEntry,
  getArchiveJournal,
  getArchiveTarget,
  getNotionToken,
  setArchiveTarget,
  setNotionConnection,
  setNotionToken,
} from 'libs/notion/storage'
import {
  ArchiveResult,
  ArchiveTabInput,
  ArchiveTarget,
  Result,
  err,
  ok,
} from 'libs/notion/types'

/** At most this many tabs are archived per confirmation (spec: tab-archiving). */
export const ARCHIVE_BATCH_CAP = 25

/** chrome.alarms name + period for the unattended run (spec: auto-archive). */
export const AUTO_ARCHIVE_ALARM = 'notion-auto-archive'
export const AUTO_ARCHIVE_PERIOD_MINUTES = 30
/** Delay of the first run after enabling — without it Chrome's first fire is a
 * full period out, which reads as "the setting did nothing". */
export const AUTO_ARCHIVE_FIRST_DELAY_MINUTES = 1

const HOUR_MS = 60 * 60 * 1000

const AUTO_SETTINGS_DEFAULTS = {
  autoArchiveEnabled: false,
  autoArchiveMaxPerRun: 5,
  staleThresholdHours: 3,
  excludePinnedTabs: true,
  excludeGroupedTabs: true,
  contentDepth: 'bookmark',
  excludedDomains: '',
  extractSuspendedTabUrl: true,
}

/** Read the sync-safe prefs the same way UserStore persists them
 * (storage.sync, falling back to storage.local). */
const readAutoSettings = async (): Promise<typeof AUTO_SETTINGS_DEFAULTS> => {
  try {
    return await browser.storage.sync.get(AUTO_SETTINGS_DEFAULTS)
  } catch (e) {
    log.warn('readAutoSettings fallback to storage.local', e)
    return browser.storage.local.get(AUTO_SETTINGS_DEFAULTS)
  }
}

export default class NotionArchiver {
  actionMap: {
    [key: string]: (request?: unknown) => Promise<unknown>
  }

  constructor() {
    this.actionMap = {
      [actions.notionTestToken]: this.testToken,
      [actions.notionSearchDatabases]: this.searchDatabases,
      [actions.notionResolveTarget]: this.resolveTarget,
      [actions.notionArchiveTabs]: this.archiveTabs,
    }
    // Top-level listeners — required for MV3 SW wake-ups (spec: auto-archive).
    browser.alarms?.onAlarm.addListener(this.onAlarm)
    browser.storage.onChanged.addListener(this.onStorageChanged)
    // Idempotent alarm reconcile on every SW start.
    void this.reconcileAlarm()
  }

  /**
   * Create or clear the periodic alarm to match `autoArchiveEnabled`, WITHOUT
   * moving the schedule of a healthy alarm (spec: auto-archive — a
   * service-worker restart never postpones the next run).
   *
   * create() replaces any same-named alarm and restarts its countdown, and this
   * runs on every SW start — so a live alarm with the expected period must be
   * left alone, or ordinary browsing resets it faster than the period elapses.
   */
  reconcileAlarm = async () => {
    if (!browser.alarms) {
      return
    }
    try {
      const { autoArchiveEnabled } = await readAutoSettings()
      if (!autoArchiveEnabled) {
        await browser.alarms.clear(AUTO_ARCHIVE_ALARM)
        return
      }
      const existing = await browser.alarms.get(AUTO_ARCHIVE_ALARM)
      if (existing?.periodInMinutes === AUTO_ARCHIVE_PERIOD_MINUTES) {
        return
      }
      await browser.alarms.create(AUTO_ARCHIVE_ALARM, {
        delayInMinutes: AUTO_ARCHIVE_FIRST_DELAY_MINUTES,
        periodInMinutes: AUTO_ARCHIVE_PERIOD_MINUTES,
      })
    } catch (e) {
      log.error('Failed to reconcile auto-archive alarm', e)
    }
  }

  onStorageChanged = (
    changes: { [key: string]: unknown },
    _areaName: string,
  ) => {
    if ('autoArchiveEnabled' in changes) {
      void this.reconcileAlarm()
    }
  }

  onAlarm = (alarm: { name: string }) => {
    if (alarm.name === AUTO_ARCHIVE_ALARM) {
      void this.runAutoArchive()
    }
  }

  /**
   * One unattended run. Reads ALL state from storage at fire time (the MV3 SW
   * is ephemeral — zero in-memory assumptions). Missing token/target ⇒ no-op.
   * Oldest-first, capped by `autoArchiveMaxPerRun`; failures are logged and
   * retried naturally on the next tick.
   */
  runAutoArchive = async () => {
    try {
      const settings = await readAutoSettings()
      if (!settings.autoArchiveEnabled) {
        return
      }
      const token = await getNotionToken()
      const target = await getArchiveTarget()
      if (!token || !target) {
        return
      }
      const now = Date.now()
      const journal = await getArchiveJournal()
      const allTabs = await browser.tabs.query({})
      const staleTabs = getStaleTabs(allTabs, {
        thresholdMs: settings.staleThresholdHours * HOUR_MS,
        now,
        journalUrls: recentJournalUrls(journal, now),
        excludePinnedTabs: settings.excludePinnedTabs,
        excludeGroupedTabs: settings.excludeGroupedTabs,
        extractSuspendedTabUrl: settings.extractSuspendedTabUrl,
        excludedDomains: parseExcludedDomains(settings.excludedDomains),
      })
      const batch = staleTabs
        .slice()
        .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0))
        .slice(0, Math.min(settings.autoArchiveMaxPerRun, ARCHIVE_BATCH_CAP))
      if (!batch.length) {
        return
      }
      log.debug('Auto-archiving stale tabs', batch.length)
      const fixed = await this.prepareFixedProperties(token, target, true)
      for (const tab of batch) {
        const result = await this.archiveOneTab(
          token,
          target,
          (() => {
            const resolved = resolveTab(tab, settings.extractSuspendedTabUrl)
            return {
              tabId: tab.id,
              title: resolved.title || tab.title || '',
              url: resolved.url,
              recovered: resolved.recovered,
            }
          })(),
          true,
          fixed,
          settings.contentDepth,
        )
        if (!result.ok) {
          log.warn('Auto-archive failed for tab (will retry next run)', tab.url)
        }
      }
    } catch (e) {
      log.error('Auto-archive run failed', e)
    }
  }

  /**
   * Verify a token (the pasted one when provided, else the stored one) and
   * persist it on success. The popup never stores the token itself.
   */
  testToken = async (
    request?: unknown,
  ): Promise<Result<{ botName: string }>> => {
    const pastedToken = (request as { token?: string } | undefined)?.token
    const token = pastedToken || (await getNotionToken())
    if (!token) {
      return err('invalid-token', 'No Notion token configured')
    }
    const result = await testToken(token)
    if (result.ok) {
      if (pastedToken) {
        await setNotionToken(pastedToken)
      }
      // Non-secret status for the popup (it never reads the token key).
      await setNotionConnection({
        botName: result.value.botName,
        verifiedAt: Date.now(),
      })
    }
    return result
  }

  searchDatabases = async (
    request?: unknown,
  ): Promise<Result<ArchiveTarget[]>> => {
    const token = await getNotionToken()
    if (!token) {
      return err('invalid-token', 'No Notion token configured')
    }
    const query = (request as { query?: string } | undefined)?.query || ''
    return searchTargets(token, query)
  }

  resolveTarget = async (request?: unknown): Promise<Result<ArchiveTarget>> => {
    const token = await getNotionToken()
    if (!token) {
      return err('invalid-token', 'No Notion token configured')
    }
    const dataSourceId = (request as { dataSourceId?: string } | undefined)
      ?.dataSourceId
    if (!dataSourceId) {
      return err('api', 'No data source id provided')
    }
    const result = await resolveTargetById(token, dataSourceId)
    if (result.ok) {
      // Re-resolving the SAME target keeps its configured fixed properties;
      // switching to a different data source resets them (design.md).
      const previous = await getArchiveTarget()
      if (previous?.dataSourceId === dataSourceId) {
        if (previous.fixedProperties) {
          result.value.fixedProperties = previous.fixedProperties
        }
        if (previous.autoFixedProperties) {
          result.value.autoFixedProperties = previous.autoFixedProperties
        }
      }
      await setArchiveTarget(result.value)
    }
    return result
  }

  /**
   * Manual archive path. Per tab, sequentially: create Notion page → append
   * journal entry → close tab. A tab whose page creation failed is NEVER
   * closed; journal always precedes close (crash loses a close, never a
   * created-page record).
   */
  archiveTabs = async (request?: unknown): Promise<Result<ArchiveResult[]>> => {
    const { tabs = [], auto = false } =
      (request as { tabs?: ArchiveTabInput[]; auto?: boolean } | undefined) ||
      {}
    const token = await getNotionToken()
    const target = await getArchiveTarget()
    if (!token || !target) {
      return err(
        'invalid-token',
        'Notion is not configured (token or target missing)',
      )
    }
    const { contentDepth } = await readAutoSettings()
    const fixed = await this.prepareFixedProperties(token, target, auto)
    const results: ArchiveResult[] = []
    for (const tab of tabs.slice(0, ARCHIVE_BATCH_CAP)) {
      results.push(
        await this.archiveOneTab(token, target, tab, auto, fixed, contentDepth),
      )
    }
    return ok(results)
  }

  /**
   * Capture the tab's main text + lead image for a "rich" archive.
   *
   * ALWAYS resolves — never rejects. Anything that goes wrong (missing optional
   * permission, unscriptable tab, script error, timeout) yields null, and the
   * caller silently falls back to bookmark-only content
   * (spec: page-content-capture — bookmark-only fallback on failure).
   */
  private capturePageContent = async (
    tabId: number,
  ): Promise<CapturedContent | null> => {
    try {
      if (!browser.scripting || !browser.permissions) {
        return null
      }
      const granted = await browser.permissions.contains({
        permissions: ['scripting'],
        origins: ['http://*/*', 'https://*/*'],
      })
      if (!granted) {
        return null
      }
      const injection = browser.scripting.executeScript({
        target: { tabId },
        func: extractPageContent,
      })
      const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS),
      )
      const frames = await Promise.race([injection, timeout])
      if (!frames || !frames.length) {
        return null
      }
      const captured = frames[0]?.result as CapturedContent | undefined
      if (!captured || (!captured.text && !captured.imageUrl)) {
        return null
      }
      return captured
    } catch (e) {
      log.warn('Page-content capture failed — archiving bookmark-only', e)
      return null
    }
  }

  /**
   * Resolve the configured fixed properties against a FRESH copy of the target
   * schema, once per archive run. Schema drift (renamed/deleted/retyped
   * property) is caught here and downgraded to per-tab warnings rather than
   * failing the page create (spec: tab-archiving).
   *
   * An unattended run additionally applies `autoFixedProperties`, merged over
   * the always-on set (spec: tab-archiving — auto-archive-only properties;
   * auto-archive — unattended runs apply the auto-archive property set). Both
   * sets share the single schema fetch.
   */
  private prepareFixedProperties = async (
    token: string,
    target: ArchiveTarget,
    auto: boolean,
  ): Promise<ReconciledProperties> => {
    const autoProperties = auto ? target.autoFixedProperties : undefined
    const configured =
      (target.fixedProperties?.length || 0) + (autoProperties?.length || 0)
    if (!configured) {
      return { properties: {}, warnings: [] }
    }
    const fresh = await resolveTargetById(token, target.dataSourceId)
    if (!fresh.ok) {
      // Can't verify the schema — skip enrichment rather than risk a 400 that
      // would block otherwise-fine archives.
      return {
        properties: {},
        warnings: [
          `Could not re-read the database schema (${fresh.error.message}) — fixed properties skipped`,
        ],
      }
    }
    return mergeReconciledProperties(
      reconcileFixedProperties(target.fixedProperties, fresh.value.properties),
      reconcileFixedProperties(autoProperties, fresh.value.properties),
    )
  }

  private archiveOneTab = async (
    token: string,
    target: ArchiveTarget,
    tab: ArchiveTabInput,
    auto: boolean,
    fixed?: { properties: Record<string, unknown>; warnings: string[] },
    contentDepth?: string,
  ): Promise<ArchiveResult> => {
    const base = { tabId: tab.tabId, url: tab.url, title: tab.title }
    const warnings = [...(fixed?.warnings || [])]
    let extraBlocks: unknown[] = []
    if (contentDepth === 'rich' && tab.recovered) {
      // The tab renders the suspender's placeholder, not the real page —
      // capturing it would archive the suspender's UI (spec: page-content-capture).
      warnings.push('Suspended tab — archived link only, page content not read')
    } else if (contentDepth === 'rich') {
      const captured = await this.capturePageContent(tab.tabId)
      if (captured) {
        extraBlocks = buildContentBlocks(captured)
      } else {
        warnings.push('Page content could not be captured — archived link only')
      }
    }
    const created = await createArchivePage(
      token,
      target,
      tab,
      fixed?.properties,
      extraBlocks,
    )
    if (!created.ok) {
      log.warn('Notion archive failed for tab', tab.url, created.error)
      return { ...base, ok: false, error: created.error.message }
    }
    // Journal BEFORE close (spec: tab-archiving — journal precedes close).
    await appendArchiveJournalEntry({
      url: tab.url,
      title: tab.title,
      pageId: created.value.pageId,
      archivedAt: Date.now(),
      auto,
    })
    try {
      await browser.tabs.remove(tab.tabId)
    } catch (e) {
      // Page + journal exist; the tab may already be gone. Still a success.
      log.warn('Tab close failed after archiving', tab.tabId, e)
    }
    return {
      ...base,
      ok: true,
      pageId: created.value.pageId,
      ...(warnings.length ? { warnings } : {}),
    }
  }
}
