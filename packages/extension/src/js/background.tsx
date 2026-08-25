import TabHistory from 'background/TabHistory'
import TabCountIcon from 'background/TabCountIcon'
import NotionArchiver from 'background/NotionArchiver'
import actions from 'libs/actions'
import { createWindow, openInNewTab, openOrTogglePopup, browser } from 'libs'

import { setBrowserIcon } from 'libs/verify'
import { clearActionBadge } from 'libs/actionBadge'

const init = async () => {
  // Edge browser has this issue: https://github.com/GoogleChrome/chrome-extensions-samples/issues/541
  if (browser.omnibox) {
    try {
      browser.omnibox.setDefaultSuggestion({
        description: 'Open tab manager window',
      })
    } catch (e) {
      console.log(e)
    }

    browser.omnibox.onInputEntered.addListener(() => {
      openOrTogglePopup()
    })
  }

  setBrowserIcon()
  // A worker torn down mid-flash would otherwise strand an archive indicator.
  clearActionBadge()
}

init()

const tabHistory = new TabHistory()
// Instantiation is enough here because the constructor registers listeners.
new TabCountIcon()
const notionArchiver = new NotionArchiver()
const _createWindow = (request, sender, sendResponse) => {
  createWindow(request.tabs)
  sendResponse()
}

const actionMap = {
  [actions.togglePopup]: openOrTogglePopup,
  [actions.openInNewTab]: openInNewTab,
  [actions.createWindow]: _createWindow,
}

Object.assign(actionMap, tabHistory.actionMap, notionArchiver.actionMap)

const onMessage = (request, sender, sendResponse) => {
  const { action } = request
  const func = actionMap[action]
  if (func && typeof func === 'function') {
    // Promise-aware dispatch: when a handler returns a Promise, return it so
    // the webextension-polyfill wires it up as the async response. Sync
    // handlers keep using sendResponse and are unaffected.
    const result = func(request, sender, sendResponse) as unknown
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      return result
    }
  } else {
    sendResponse(`Unknown action: ${action}`)
  }
}

const onCommand = (action: string) => {
  const func = actionMap[action]
  if (func && typeof func === 'function') {
    func()
  }
}

browser.runtime.onMessage.addListener(onMessage)
browser.commands.onCommand.addListener(onCommand)

const onInstalled = (details: chrome.runtime.InstalledDetails) => {
  if (details.reason === 'install') {
    openInNewTab()
  }
}

browser.runtime.onInstalled.addListener(onInstalled)
