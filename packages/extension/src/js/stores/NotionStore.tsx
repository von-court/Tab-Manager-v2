import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
  toJS,
} from 'mobx'
import { browser } from 'libs'
import actions from 'libs/actions'
import log from 'libs/log'
import {
  NotionConnection,
  getArchiveJournal,
  getArchiveTarget,
  getNotionConnection,
  setArchiveTarget,
} from 'libs/notion/storage'
import {
  ArchiveJournalEntry,
  ArchiveTarget,
  FixedProperty,
  Result,
  TargetProperty,
  isFixedPropertyType,
} from 'libs/notion/types'
import Store from 'stores'

/**
 * Popup-side state for the Notion tab-archive feature: connection status,
 * archive target + property mapping, and the archive journal.
 *
 * SECURITY: this store never holds the Notion token. It reads only the
 * non-secret storage.local keys (connection status, target, journal) and
 * messages the service worker for anything that needs the token.
 * Spec: openspec/changes/notion-tab-archive/specs/notion-connection/spec.md
 */
export default class NotionStore {
  store: Store

  constructor(store: Store) {
    makeObservable(this, {
      connection: observable,
      target: observable,
      journal: observable,
      verifying: observable,
      verifyError: observable,
      searchResults: observable,
      searching: observable,
      searchError: observable,
      loaded: observable,
      isConfigured: computed,
      mappingHint: computed,
      editableProperties: computed,
      fixedProperties: computed,
      verifyToken: action,
      searchDatabases: action,
      selectTarget: action,
      setFixedProperties: action,
      init: action,
    })
    this.store = store
    this.init()
  }

  connection: NotionConnection | null = null

  target: ArchiveTarget | null = null

  journal: ArchiveJournalEntry[] = []

  verifying = false

  verifyError: string | null = null

  searchResults: ArchiveTarget[] = []

  searching = false

  searchError: string | null = null

  loaded = false

  /** Archive features unlock only when token is verified AND a target picked. */
  get isConfigured(): boolean {
    return Boolean(this.connection && this.target)
  }

  get mappingHint(): string {
    if (!this.target) {
      return ''
    }
    const urlPart = this.target.urlPropName
      ? `URL → ${this.target.urlPropName}`
      : 'URL → bookmark block only'
    return `Title → ${this.target.titlePropName}, ${urlPart}`
  }

  /** Target properties the fixed-properties editor may offer (supported types
   * only, and never the title/URL properties the archiver already owns). */
  get editableProperties(): TargetProperty[] {
    const properties = this.target?.properties
    if (!Array.isArray(properties)) {
      return []
    }
    return properties.filter(
      (property) =>
        isFixedPropertyType(property.type) &&
        property.name !== this.target.titlePropName &&
        property.name !== this.target.urlPropName,
    )
  }

  get fixedProperties(): FixedProperty[] {
    const configured = this.target?.fixedProperties
    return Array.isArray(configured) ? configured : []
  }

  /** Persist the configured fixed properties onto the stored target. The
   * target is non-secret, so the popup may write storage.local directly; the
   * SW re-reads it on every archive run. */
  setFixedProperties = async (fixedProperties: FixedProperty[]) => {
    if (!this.target) {
      return
    }
    // toJS() is REQUIRED: chrome.storage structured-clones a MobX observable
    // array proxy into a numeric-keyed plain object ({"0":…}), which then has
    // no .filter/.map when read back. Persist plain data only.
    const nextTarget: ArchiveTarget = toJS({
      ...this.target,
      fixedProperties,
    })
    await setArchiveTarget(nextTarget)
    runInAction(() => {
      this.target = nextTarget
    })
  }

  init = async () => {
    try {
      const [connection, target, journal] = await Promise.all([
        getNotionConnection(),
        getArchiveTarget(),
        getArchiveJournal(),
      ])
      runInAction(() => {
        this.connection = connection
        this.target = target
        this.journal = journal
        this.loaded = true
      })
    } catch (e) {
      log.error('NotionStore.init failed', e)
      runInAction(() => {
        this.loaded = true
      })
    }
  }

  /** Verify a pasted token (or the stored one when empty) via the SW. */
  verifyToken = async (token: string): Promise<boolean> => {
    this.verifying = true
    this.verifyError = null
    try {
      const result: Result<{ botName: string }> =
        await browser.runtime.sendMessage({
          action: actions.notionTestToken,
          ...(token ? { token } : {}),
        })
      if (result?.ok) {
        runInAction(() => {
          this.connection = {
            botName: result.value.botName,
            verifiedAt: Date.now(),
          }
        })
        return true
      }
      runInAction(() => {
        this.verifyError =
          result?.ok === false ? result.error.message : 'Verification failed'
      })
      return false
    } catch (e) {
      runInAction(() => {
        this.verifyError = e instanceof Error ? e.message : String(e)
      })
      return false
    } finally {
      runInAction(() => {
        this.verifying = false
      })
    }
  }

  searchDatabases = async (query: string) => {
    this.searching = true
    this.searchError = null
    try {
      const result: Result<ArchiveTarget[]> = await browser.runtime.sendMessage(
        {
          action: actions.notionSearchDatabases,
          query,
        },
      )
      runInAction(() => {
        if (result?.ok) {
          this.searchResults = result.value
        } else {
          this.searchResults = []
          this.searchError =
            result?.ok === false ? result.error.message : 'Search failed'
        }
      })
    } catch (e) {
      runInAction(() => {
        this.searchResults = []
        this.searchError = e instanceof Error ? e.message : String(e)
      })
    } finally {
      runInAction(() => {
        this.searching = false
      })
    }
  }

  /** Resolve + persist the picked data source as the archive target (via SW). */
  selectTarget = async (dataSourceId: string) => {
    try {
      const result: Result<ArchiveTarget> = await browser.runtime.sendMessage({
        action: actions.notionResolveTarget,
        dataSourceId,
      })
      if (result?.ok) {
        runInAction(() => {
          this.target = result.value
        })
      } else {
        runInAction(() => {
          this.searchError =
            result?.ok === false
              ? result.error.message
              : 'Target resolution failed'
        })
      }
    } catch (e) {
      runInAction(() => {
        this.searchError = e instanceof Error ? e.message : String(e)
      })
    }
  }

  refreshJournal = async () => {
    const journal = await getArchiveJournal()
    runInAction(() => {
      this.journal = journal
    })
  }
}
