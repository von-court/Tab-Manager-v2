// Transient toolbar-badge feedback for archives triggered outside the popup
// (spec: tab-archiving — feedback for archives triggered outside the popup).
//
// Deliberately uses the badge API, which nothing else touches: the tab-count
// indicator is painted INTO the icon image by `setBrowserIcon`, so the two are
// independent channels and a flash can never lose a count.

import { browser } from 'libs'

/** How long the outcome stays on the badge before it is cleared. */
export const BADGE_FLASH_MS = 1500

const BADGE_STATES = {
  success: { text: '✓', color: '#2e7d32' },
  failure: { text: '!', color: '#c62828' },
} as const

type BadgeAction = {
  setBadgeText?: (details: { text: string }) => unknown
  setBadgeBackgroundColor?: (details: { color: string }) => unknown
}

const eachAction = (apply: (action: BadgeAction) => void) => {
  ;[browser.browserAction, browser.action].forEach((action: BadgeAction) => {
    if (action) {
      apply(action)
    }
  })
}

export const clearActionBadge = () => {
  eachAction((action) => action.setBadgeText?.({ text: '' }))
}

/**
 * Show the outcome, then hand the badge back. The timer normally runs before
 * the service worker is torn down; `background.tsx` clears the badge on every
 * start as well, so a worker killed mid-flash cannot strand an indicator.
 */
export const flashActionBadge = (succeeded: boolean) => {
  const { text, color } = succeeded
    ? BADGE_STATES.success
    : BADGE_STATES.failure
  eachAction((action) => {
    action.setBadgeBackgroundColor?.({ color })
    action.setBadgeText?.({ text })
  })
  setTimeout(clearActionBadge, BADGE_FLASH_MS)
}
