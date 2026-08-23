## Context

Fixed properties live inside the persisted `ArchiveTarget` in `chrome.storage.local`, are
reconciled against a fresh schema once per run in `NotionArchiver.prepareFixedProperties`, and are
spread into the page payload by `createArchivePage` before the title/URL mapping (so the mapping
always wins). The trigger source already reaches the per-tab call as the `auto: boolean` that ends
up in the journal entry, but nothing branches on it. See proposal.md — Why.

## Goals / Non-Goals

**Goals:**

- One extra property set, persisted and reconciled by the same machinery as the existing one.
- Trigger-awareness stays a single boolean; no new message shape between popup and worker.
- A drifted or unencodable auto property degrades to a warning, never to a blocked archive.

**Non-Goals:**

- Per-trigger sets for the manual dialog or the immediate shortcut. The worker cannot tell those
  two apart today (both send `auto: false`) and nothing here needs it to.
- Property types beyond the existing `FIXED_PROPERTY_TYPES` whitelist.
- Backfilling or migrating targets configured before this change — an absent list means "none".

## Decisions

**Store it on `ArchiveTarget` as `autoFixedProperties`, not as a separate storage key.**
Both sets name properties of one schema and must be dropped together when the target changes;
`resolveTarget` already preserves fixed properties only while `dataSourceId` is unchanged, and one
more field inherits that for free. A separate key would need its own invalidation.
Alternative — a single list with a `scope: 'always' | 'auto'` field — was rejected: it complicates
the persisted shape and the storage-healing code for two editors that are otherwise independent.

**Merge after reconciliation, on the encoded payloads, keyed by property name.**
Each set is reconciled separately against the same fresh schema fetch, then merged. `multi_select`
is the only type where both sets can contribute: its encoded value is a list of `{name}`, so the
union is a concatenation deduped by name, always-on values first. Every other type is a scalar and
the auto value replaces it. Merging the raw `FixedProperty` values before encoding was rejected —
it would need per-type union logic in a second place, and reconciliation may drop either side.

**Reconcile both sets from one `resolveTargetById` call.**
`prepareFixedProperties` takes the trigger flag and returns the merged `{properties, warnings}`.
An unattended run therefore costs the same single schema fetch it costs today, and a schema fetch
failure keeps its current behavior: skip all enrichment with one warning rather than risk a 400.

**Reuse `FixedPropertiesEditor` for both editors.**
The component becomes parameterized over its rows and its commit callback (plus a label and
testids), rendered twice inside the same gated block. The auto editor's property picker offers the
full `editableProperties` list, including properties already used by the always-on set — the
overlap is the point.

## Risks / Trade-offs

- [The two editors read as one long list and the distinction gets missed] → the auto editor sits
  under the auto-archive toggle with an explicit "applies only to automatic runs" label.
- [A user configures an auto-only `select` that silently overrides a fixed one] → specified and
  documented behavior; the override is the only sane rule for a single-valued property.
- [Settings-dialog snapshots shift on Linux] → snapshot-sensitive area per AGENTS.md; treat a
  baseline refresh as approved follow-up work, not part of this change.
- [Auto properties applied to a run the user considers manual] → the flag is the journal's `auto`,
  which is set only by the alarm-driven run; the shortcut and dialog paths both pass `false`.

## Migration Plan

None. `autoFixedProperties` is absent on every existing target and reads as an empty list; with no
auto properties configured, page payloads are byte-identical to today's.
