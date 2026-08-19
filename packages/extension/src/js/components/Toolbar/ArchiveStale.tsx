import React from 'react'
import { observer } from 'mobx-react-lite'
import { ArchiveRoundedIcon } from 'icons/materialIcons'
import IconButton from 'components/ui/IconButton'
import Tooltip from 'components/ui/Tooltip'
import { TOOLTIP_DELAY, getNoun } from 'libs'
import { useStore } from 'components/hooks/useStore'

export default observer(() => {
  const { notionStore, staleTabsStore } = useStore()
  if (!notionStore.isConfigured) {
    // Invisible until a Notion connection is configured (spec: tab-archiving).
    return null
  }
  const count = staleTabsStore.staleTabs.length
  const title = count
    ? `Archive ${count} stale ${getNoun('tab', count)} to Notion`
    : 'Archive stale tabs to Notion'
  return (
    <Tooltip title={title} enterDelay={TOOLTIP_DELAY}>
      <div className="flex">
        <IconButton
          onClick={staleTabsStore.openDialog}
          className="focus:outline-none"
          aria-label={title}
          data-testid="archive-stale-button"
        >
          <ArchiveRoundedIcon />
        </IconButton>
      </div>
    </Tooltip>
  )
})
