import React from 'react'
import { observer } from 'mobx-react-lite'
import Dialog, { DialogTitle, DialogContent } from 'components/ui/Dialog'
import Checkbox from 'components/ui/Checkbox'
import Snackbar from 'components/ui/Snackbar'
import { useStore } from 'components/hooks/useStore'
import { useAppTheme } from 'libs/appTheme'
import { getDomain, getNoun } from 'libs'
import { resolveTab } from 'libs/staleness'
import Tab from 'stores/Tab'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const formatIdleAge = (lastAccessed: number | undefined, now: number) => {
  if (typeof lastAccessed !== 'number') {
    return ''
  }
  const idleMs = Math.max(0, now - lastAccessed)
  if (idleMs >= DAY_MS) {
    const days = Math.floor(idleMs / DAY_MS)
    return `${days} d idle`
  }
  if (idleMs >= HOUR_MS) {
    const hours = Math.floor(idleMs / HOUR_MS)
    return `${hours} h idle`
  }
  const minutes = Math.floor(idleMs / (60 * 1000))
  return `${minutes} min idle`
}

const rowTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const StaleTabRow = observer(({ tab }: { tab: Tab }) => {
  const { staleTabsStore, notionStore, userStore } = useStore()
  const { nowTick, isTabChecked, toggleTab, results, archiving } =
    staleTabsStore
  const result = results.get(tab.id)
  // Show what will actually be archived: a suspended tab's real page, not the
  // suspender's placeholder URL (spec: stale-tab-detection).
  const resolved = resolveTab(tab, userStore.extractSuspendedTabUrl)
  const displayUrl = resolved.url || tab.url
  const displayTitle = resolved.title || tab.title
  const displayDomain = resolved.recovered
    ? getDomain(resolved.url)
    : tab.domain
  // "Archived N d ago" badge (journal keeps entries past the dedup window).
  const journalEntry = notionStore.journal.find(
    (entry) => entry.url === displayUrl,
  )
  const archivedDaysAgo = journalEntry
    ? Math.floor((nowTick - journalEntry.archivedAt) / DAY_MS)
    : null
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <Checkbox
        checked={isTabChecked(tab)}
        disabled={archiving || !!result?.ok}
        onChange={() => toggleTab(tab)}
        aria-label={`Archive ${displayTitle || displayUrl}`}
      />
      <img
        src={tab.iconUrl}
        alt=""
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div
          style={{ ...rowTextStyle, fontSize: '0.88rem' }}
          title={displayTitle}
        >
          {displayTitle || displayUrl}
        </div>
        <div
          style={{ ...rowTextStyle, fontSize: '0.76rem', opacity: 0.65 }}
          title={displayUrl}
        >
          {displayDomain} · {formatIdleAge(tab.lastAccessed, nowTick)}
          {resolved.recovered && <> · suspended</>}
          {archivedDaysAgo !== null && <> · archived {archivedDaysAgo} d ago</>}
        </div>
        {result && !result.ok && (
          <div style={{ fontSize: '0.76rem', color: '#e5484d' }}>
            ✗ {result.error}
          </div>
        )}
      </div>
      {result?.ok && (
        <span aria-label="Archived" style={{ color: '#30a46c' }}>
          ✓
        </span>
      )}
    </div>
  )
})

export default observer(() => {
  const theme = useAppTheme()
  const { staleTabsStore, notionStore, userStore } = useStore()
  const {
    dialogOpen,
    closeDialog,
    staleTabs,
    checkedTabs,
    archiving,
    archiveCheckedTabs,
    snackbarMessage,
  } = staleTabsStore
  const count = checkedTabs.length
  const confirmLabel = archiving
    ? 'Archiving…'
    : `Archive ${count} ${getNoun('tab', count)} to Notion`
  return (
    <>
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
        data-testid="stale-tabs-review-dialog"
        style={{ color: theme.palette.text.primary }}
      >
        <DialogTitle>Archive stale tabs</DialogTitle>
        <DialogContent>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>
            Tabs idle for more than {userStore.staleThresholdHours} h.
            Successfully archived tabs are closed; failed tabs stay open.
          </p>
          <div className="mt-3 max-h-96 space-y-0.5 overflow-y-auto">
            {staleTabs.length === 0 && (
              <p style={{ fontSize: '0.88rem', opacity: 0.7 }}>
                No stale tabs right now. 🎉
              </p>
            )}
            {staleTabs.map((tab) => (
              <StaleTabRow key={tab.id} tab={tab} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              style={{
                border: '1px solid var(--input-border, rgba(0,0,0,0.23))',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void archiveCheckedTabs()}
              disabled={archiving || count === 0 || !notionStore.isConfigured}
              data-testid="stale-tabs-confirm-button"
              style={{
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: theme.palette.primary.main,
                color: '#fff',
                cursor: archiving || count === 0 ? 'default' : 'pointer',
                opacity: archiving || count === 0 ? 0.55 : 1,
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Snackbar
        open={!!snackbarMessage}
        message={snackbarMessage}
        data-testid="stale-tabs-snackbar"
      />
    </>
  )
})
