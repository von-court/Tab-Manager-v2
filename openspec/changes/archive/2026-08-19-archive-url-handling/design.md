# Design: archive-url-handling

## Context

`libs/staleness.ts` is a pure module already taking caller-supplied options, and it makes every
URL decision from `tab.url` directly. `UserStore.save()` writes `this[key]` for each key in
`DEFAULT_SETTINGS` straight into `storage.sync` — every current setting is a scalar, so the MobX
observable-array corruption found in the archive target has not been able to bite here yet.

Measured behaviour of Tab Suspender 2.0.12 (the installed one): parking navigates the tab to
`chrome-extension://<id>/park.html?tabId=…&title=<title>&url=<encoded real URL>&sessionId=…`.
`lastAccessed` is preserved across both this navigation and native `chrome.tabs.discard()`.

## Goals / Non-Goals

**Goals:**

- Never archive a listed domain, from any entry point.
- Make parked tabs archivable under their real identity, without hardcoding one extension.
- Keep all of it in pure, testable helpers rather than sprinkling URL logic across stores.

**Non-Goals:**

- Un-parking or waking suspended tabs to capture their content — recovering the link is enough.
- Path/wildcard/regex exclusion rules; hostname-and-subdomain matching covers the stated need.
- Reading a suspender's internal storage to resolve tabs it parked before this feature existed.

## Decisions

1. **A new pure module `libs/suspendedTabs.ts`** owns both URL concerns: `extractSuspendedUrl()`
   and hostname/domain matching. `libs/staleness.ts` imports it and resolves each tab once via a
   single `resolveTab()` helper that returns `{url, title, recovered}`. Every consumer — staleness,
   the popup store, the service worker — goes through that one helper, so the resolved identity
   cannot diverge between "is it eligible" and "what do we archive".

2. **Generic placeholder detection, not an extension allowlist.** A URL qualifies when its scheme
   is `chrome-extension:`/`moz-extension:` and any parameter in its query string _or_ hash decodes
   to an `http(s)` URL. Scanning both is necessary: Tab Suspender uses `?url=`, The Great Suspender
   and its forks use `#uri=`. Preferring a parameter named `url`/`uri`/`u` before falling back to
   "any URL-valued parameter" keeps the common case exact while still handling unknown suspenders.
   Alternative considered: match the installed extension's id (rejected — breaks on a different
   suspender, on an id change, and is untestable without that extension present).

3. **Domain exclusion applies to every path, including the immediate shortcut.** It reads as a
   safety list ("never put this in Notion"), unlike the staleness heuristics the shortcut
   deliberately bypasses. Refused tabs are reported as skipped with a distinct reason so the
   behaviour is never silent. Alternative considered: let an explicit selection override the list
   (rejected — a "never" rule with an exception is exactly the kind of surprise that puts an
   unwanted page in the 2nd brain).

4. **Excluded domains are stored as newline-separated text, not an array.** The field is naturally
   a textarea, and text sidesteps the observable-array persistence trap entirely. Parsing to
   hostnames happens at use time, where entries are normalized (strip scheme, path, port, leading
   `www.`, lowercase). Independently, `save()` is hardened with `toJS()` so a future list-valued
   setting cannot reintroduce the corruption — the spec requirement is about the guarantee, not
   about this particular field's shape.

5. **Recovered tabs skip content capture.** The renderer holds the placeholder, so injecting would
   archive the suspender's own UI as the page body — worse than no content. `resolveTab()` already
   reports `recovered`, so the archiver short-circuits capture and emits the existing
   "archived link only" style warning.

## Risks / Trade-offs

- [A suspender that stores the real URL only in its own storage, not the placeholder URL] → not
  recoverable by this approach; such tabs stay excluded exactly as today. Detection is best-effort
  by design.
- [Over-broad subdomain matching] → `notion.com` also excluding `app.notion.com` is the intended
  reading and matches how people think about "exclude this site"; a user wanting one host only can
  list that host, since matching is a suffix on label boundaries (`notionary.example.com` is not
  matched by `notion.com`).
- [Skipping capture for parked tabs means rich mode quietly yields less] → surfaced per tab as a
  warning rather than hidden, and the link plus title still land.
