## Context

Every archive entry point today is a Mousetrap binding inside the popup (`shift+a`, `shift+ctrl+a`)
or a toolbar button, so archiving always costs a popup round trip. The extension already routes
`chrome.commands` through the same `actionMap` as `runtime.onMessage`
(`background.tsx`: `onCommand = (action) => actionMap[action]?.()`), and `NotionArchiver` already
exposes its handlers by merging `notionArchiver.actionMap` into that map. A browser-level command
therefore needs no new dispatch machinery — only a handler that works with no arguments.

Chrome caps an extension at four commands carrying a `suggested_key`, and all four are spent
(`_execute_action`, `TOGGLE-POPUP`, `LAST-ACTIVE-TAB`, `OPEN-IN-NEW-TAB`). Declaring a fifth
command without a suggested key is fine: Chrome still lists it under
`chrome://extensions/shortcuts` with an empty binding for the user to fill in.

## Goals / Non-Goals

**Goals**

- Archive the page being read without opening the popup.
- Reuse the existing archive orchestration rather than growing a second one.
- Make the outcome visible when no extension UI is open.
- Make the command discoverable despite having no default key.

**Non-Goals**

- Rebinding or freeing one of the four existing suggested-key slots.
- A context-menu entry or a page-action button. Same capability, different change.
- Archiving anything other than the active tab (multi-tab is what the popup is for).
- Firefox. The Notion feature ships behind the MV3 manifest only.

## Decisions

**Handler reuses `archiveTabs`, not `archiveOneTab`.** The new handler queries the active tab of
the focused window, resolves its identity, applies the refusal rules, and then delegates to
`this.archiveTabs({ tabs: [input], auto: false })`. That inherits token/target lookup, the
content-depth read, fixed-property preparation and reconciliation, the batch cap, and the
create → journal → close sequence with its invariants. Calling `archiveOneTab` directly would mean
re-implementing the first half of `archiveTabs` and would leave two places to update whenever the
archive pipeline changes.

_Consequence:_ the handler is also message-callable for free, so a future toolbar button needs no
new action.

**One archivability predicate, in `libs/staleness.ts`.** `HTTP_SCHEME` is currently declared three
times (`staleness.ts`, `suspendedTabs.ts`, `StaleTabsStore.tsx`), and the refuse-then-count loop in
`StaleTabsStore.archiveSelectedNow` is the only implementation of the "not http(s) / excluded
domain" rule. The spec now requires the same rule in the service worker, which cannot import a
MobX store. So export one predicate — resolved URL plus excluded domains in, a refusal reason or
`null` out — from `staleness.ts` (already the shared, browser-free module used by both sides) and
have `StaleTabsStore` consume it too, deleting its local copy.

_Alternative rejected:_ duplicating the two checks in `NotionArchiver`. Three copies of the rule
that decides what may never be archived is exactly how the popup and the background drift apart.

**Badge flash on a channel the icon does not own.** The tab-count indicator is _painted into the
icon image_ by `setBrowserIcon` (canvas → `action.setIcon`); the real badge API is unused. The
flash therefore uses `action.setBadgeText` + `setBadgeBackgroundColor` and clears the text
afterwards — two independent channels, so the flash never has to reconstruct the icon and cannot
lose a tab count. The overlap is cosmetic and brief, and `actionTabCountMode` defaults to `off`,
so most users see the badge alone.

_Restore is belt and braces:_ a `setTimeout` clears it after ~1.5 s, and `background.tsx` also
clears the badge at service-worker start, so a worker torn down mid-flash cannot strand a ✓ on the
toolbar. Both live in a small `libs/actionBadge.ts` beside `verify.tsx`, guarding
`browser.action` / `browser.browserAction` the way `setBrowserIcon` does.

_Alternative rejected:_ painting the check into the icon through the existing canvas pipeline.
Prettier, but it means owning the restore of an image that another module also writes, for 1.5
seconds of polish.

**Settings hint opens the shortcuts page via `tabs.create`.** An `<a href="chrome://…">` in an
extension page is inert — Chrome refuses the navigation. The hint renders as a button that calls
`browser.tabs.create({ url: 'chrome://extensions/shortcuts' })`, which is permitted.

## Risks / Trade-offs

- **A hotkey that closes the current tab is destructive and unconfirmed.** That is the point, and
  it matches `shift+ctrl+a`, but a mis-bound key (say, something near `ctrl+w`) will surprise
  people. Mitigation: no default binding — the user picks the key deliberately. The archived page
  and journal entry mean nothing is actually lost.
- **The badge is easy to miss** when the browser window is not focused or the toolbar icon is
  hidden in the overflow menu. Accepted for now; a notification needs a new permission and an
  install-time prompt, which is a poor trade for a feature not everyone uses.
- **`prepareFixedProperties` costs one Notion request** per invocation when fixed properties are
  configured, so a rapid-fire hotkey is a rapid-fire schema fetch. The client already serializes
  requests at ~3 rps, so this degrades latency rather than correctness.
- **Touching `StaleTabsStore`** puts the popup's immediate-archive path in the blast radius of what
  is otherwise a background-only feature. The predicate extraction is mechanical and the existing
  behavior is covered by the skipped-tab scenarios in `tab-archiving`.

## Migration Plan

None. New command, no stored state, no permission change. Existing installs see the command appear
unbound after the update; nothing changes for users who never bind it.
