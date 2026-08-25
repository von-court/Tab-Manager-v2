import { action, computed, makeObservable, observable, runInAction } from 'mobx'
import { browser } from 'libs'
import actions from 'libs/actions'
import log from 'libs/log'
import {
  archiveRefusal,
  getStaleTabs,
  recentJournalUrls,
  resolveTab,
} from 'libs/staleness'
import { parseExcludedDomains } from 'libs/suspendedTabs'
import { ArchiveResult, Result } from 'libs/notion/types'
import Store from 'stores'
import Tab from './Tab'

const HOUR_MS = 60 * 60 * 1000

/**
 * Popup-side state for the manual stale-tab review flow: the proposed stale
 * tabs, the review dialog, per-tab check state, and archive progress/results.
 * Specs: openspec/changes/notion-tab-archive/specs/{stale-tab-detection,tab-archiving}/spec.md
 */
export default class StaleTabsStore {
  store: Store

  constructor(store: Store) {
    makeObservable(this, {
      dialogOpen: observable,
      nowTick: observable,
      uncheckedTabIds: observable,
      archiving: observable,
      results: observable,
      snackbarMessage: observable,
      staleTabs: computed,
      checkedTabs: computed,
      openDialog: action,
      closeDialog: action,
      toggleDialog: action,
      toggleTab: action,
      archiveCheckedTabs: action,
      archiveSelectedNow: action,
      showSnackbar: action,
      hideSnackbar: action,
    })
    this.store = store
  }

  dialogOpen = false

  /** Refreshed when the dialog opens so `staleTabs` evaluates against "now". */
  nowTick = Date.now()

  /** Inverted check state: all stale tabs are checked by default. */
  uncheckedTabIds = new Set<number>()

  archiving = false

  /** tabId → result of the last archive run (per-tab ✓/✗ in the dialog). */
  results = new Map<number, ArchiveResult>()

  snackbarMessage: string | null = null

  private snackbarTimer: ReturnType<typeof setTimeout> | null = null

  showSnackbar = (message: string) => {
    this.snackbarMessage = message
    if (this.snackbarTimer) {
      clearTimeout(this.snackbarTimer)
    }
    this.snackbarTimer = setTimeout(this.hideSnackbar, 5000)
  }

  hideSnackbar = () => {
    this.snackbarMessage = null
    this.snackbarTimer = null
  }

  get staleTabs(): Tab[] {
    const { userStore, windowStore, notionStore } = this.store
    const thresholdMs = userStore.staleThresholdHours * HOUR_MS
    const journalUrls = recentJournalUrls(notionStore.journal, this.nowTick)
    const allTabs = windowStore.windows.flatMap((win) => win.tabs)
    return getStaleTabs(allTabs, {
      thresholdMs,
      now: this.nowTick,
      journalUrls,
      excludePinnedTabs: userStore.excludePinnedTabs,
      excludeGroupedTabs: userStore.excludeGroupedTabs,
      extractSuspendedTabUrl: userStore.extractSuspendedTabUrl,
      excludedDomains: parseExcludedDomains(userStore.excludedDomains),
    })
  }

  get checkedTabs(): Tab[] {
    return this.staleTabs.filter((tab) => !this.uncheckedTabIds.has(tab.id))
  }

  isTabChecked = (tab: Tab) => !this.uncheckedTabIds.has(tab.id)

  openDialog = () => {
    this.nowTick = Date.now()
    this.uncheckedTabIds = new Set()
    this.results = new Map()
    void this.store.notionStore.refreshJournal()
    this.dialogOpen = true
  }

  closeDialog = () => {
    this.dialogOpen = false
  }

  toggleDialog = () => {
    if (this.dialogOpen) {
      this.closeDialog()
      return
    }
    if (!this.store.notionStore.isConfigured) {
      return
    }
    this.openDialog()
  }

  toggleTab = (tab: Tab) => {
    const next = new Set(this.uncheckedTabIds)
    if (next.has(tab.id)) {
      next.delete(tab.id)
    } else {
      next.add(tab.id)
    }
    this.uncheckedTabIds = next
  }

  /**
   * Archive the selected tabs — or the focused tab when nothing is selected —
   * immediately: no staleness check, no review dialog, no confirmation.
   * Staleness/exclusions/dedup are deliberately skipped because the user
   * pointed at these tabs; only non-http(s) tabs are refused.
   * Spec: openspec/specs/tab-archiving/spec.md
   */
  archiveSelectedNow = async (): Promise<ArchiveResult[]> => {
    if (this.archiving || !this.store.notionStore.isConfigured) {
      return []
    }
    const { tabStore, focusStore } = this.store
    const selected = tabStore.sources as Tab[]
    const focused =
      focusStore.focusedItem instanceof Tab
        ? [focusStore.focusedItem as Tab]
        : []
    const chosen = Array.from(
      new Map(
        (selected.length ? selected : focused).map((tab) => [tab.id, tab]),
      ).values(),
    )
    if (!chosen.length) {
      return []
    }
    const { userStore } = this.store
    const domains = parseExcludedDomains(userStore.excludedDomains)
    const archivable: Tab[] = []
    let notHttp = 0
    let excluded = 0
    for (const tab of chosen) {
      const { url } = resolveTab(tab, userStore.extractSuspendedTabUrl)
      const refusal = archiveRefusal(url, domains)
      if (refusal === 'not-http') {
        notHttp += 1
      } else if (refusal) {
        excluded += 1
      } else {
        archivable.push(tab)
      }
    }
    const skipped = notHttp + excluded
    if (!archivable.length) {
      const reason = excluded
        ? 'excluded domain'
        : 'only http/https pages can be archived'
      this.showSnackbar(
        skipped === 1
          ? `That tab was skipped (${reason})`
          : `${skipped} tabs skipped (${reason})`,
      )
      return []
    }
    return this.runArchive(archivable, skipped)
  }

  /** Confirm: archive the checked tabs via the service worker. */
  archiveCheckedTabs = async (): Promise<ArchiveResult[]> => {
    const tabs = this.checkedTabs
    if (!tabs.length || this.archiving) {
      return []
    }
    return this.runArchive(tabs, 0)
  }

  /**
   * Shared send/report half of both entry points: message the SW, record
   * per-tab results, refresh the journal, raise the snackbar.
   */
  private runArchive = async (
    tabs: Tab[],
    skipped: number,
  ): Promise<ArchiveResult[]> => {
    this.archiving = true
    try {
      const result: Result<ArchiveResult[]> = await browser.runtime.sendMessage(
        {
          action: actions.notionArchiveTabs,
          tabs: tabs.map((tab) => {
            const resolved = resolveTab(
              tab,
              this.store.userStore.extractSuspendedTabUrl,
            )
            return {
              tabId: tab.id,
              title: resolved.title || tab.title,
              url: resolved.url,
              recovered: resolved.recovered,
            }
          }),
          auto: false,
        },
      )
      if (!result?.ok) {
        const message =
          result?.ok === false ? result.error.message : 'Archive failed'
        log.error('Archive run failed', message)
        runInAction(() => {
          this.results = new Map(
            tabs.map((tab) => [
              tab.id,
              {
                tabId: tab.id,
                url: tab.url,
                title: tab.title,
                ok: false,
                error: message,
              },
            ]),
          )
        })
        this.showSnackbar(`Archive failed: ${message}`)
        return [...this.results.values()]
      }
      runInAction(() => {
        this.results = new Map(
          result.value.map((entry) => [entry.tabId, entry]),
        )
      })
      await this.store.notionStore.refreshJournal()
      const succeeded = result.value.filter((entry) => entry.ok).length
      const failed = result.value.length - succeeded
      const skippedSuffix = skipped
        ? `, ${skipped} skipped (not http/https)`
        : ''
      this.showSnackbar(
        failed === 0
          ? `Archived ${succeeded} ${succeeded === 1 ? 'tab' : 'tabs'} to Notion${skippedSuffix}`
          : `Archived ${succeeded} ${succeeded === 1 ? 'tab' : 'tabs'} to Notion (${failed} failed — see dialog)${skippedSuffix}`,
      )
      return result.value
    } finally {
      runInAction(() => {
        this.archiving = false
      })
    }
  }
}
