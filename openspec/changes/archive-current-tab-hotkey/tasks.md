## 1. Shared archivability rule

- [ ] 1.1 Export one refusal predicate from `libs/staleness.ts` taking a resolved URL and the
      parsed excluded domains, returning `null` or a refusal reason (`not-http` / `excluded-domain`)
- [ ] 1.2 Rewrite `StaleTabsStore.archiveSelectedNow` to count refusals through that predicate and
      delete its local `HTTP_SCHEME`
- [ ] 1.3 Unit-test the predicate (http, https, `chrome://`, empty, excluded domain, subdomain)

## 2. Command plumbing

- [ ] 2.1 Declare `NOTION-ARCHIVE-CURRENT-TAB` in `manifest-v3.json` with a description and NO
      `suggested_key`; leave the MV2 manifest untouched
- [ ] 2.2 Add the action id to `libs/actions.tsx`
- [ ] 2.3 Add an argless `archiveCurrentTab` handler to `NotionArchiver.actionMap`: query the
      active tab of the focused window, resolve it via `resolveTab`, apply the refusal predicate,
      then delegate to `archiveTabs({ tabs: [input], auto: false })`
- [ ] 2.4 Reference `spec: tab-archiving` in the handler docstring and state that it is a manual
      path (never the auto-archive property set)

## 3. Badge feedback

- [ ] 3.1 Add `libs/actionBadge.ts` with a flash helper (success / failure state), a clear helper,
      and `browser.action` / `browser.browserAction` guards
- [ ] 3.2 Flash success or failure from the command handler, including the refusal paths and the
      not-configured path
- [ ] 3.3 Clear the badge at service-worker start in `background.tsx`, next to `setBrowserIcon()`
- [ ] 3.4 Unit-test the helper against the `sinon-chrome` action stub (sets text and colour, clears
      after the timer, no-ops when the API is absent)

## 4. Discoverability

- [ ] 4.1 Add the hint to the Notion panel in `SettingsDialog.tsx`, naming the command, as a button
      that opens `chrome://extensions/shortcuts` via `browser.tabs.create`

## 5. Verification

- [ ] 5.1 `pnpm build`
- [ ] 5.2 Scoped eslint + prettier on the touched files
- [ ] 5.3 Run the new unit tests (needs human approval per AGENTS.md)
- [ ] 5.4 Linux settings-dialog snapshot refresh for the new hint (needs human approval)
- [ ] 5.5 Manual check (human): bind a key in `chrome://extensions/shortcuts`, archive a page from
      the page itself, confirm the Notion page, the closed tab, the badge flash and its restore,
      and that a `chrome://` tab is refused and stays open
