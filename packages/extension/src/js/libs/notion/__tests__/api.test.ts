// Merge rules for the auto-archive-only property set
// (spec: tab-archiving — auto-archive-only properties).

import {
  mergeReconciledProperties,
  reconcileFixedProperties,
} from 'libs/notion/api'
import { FixedProperty, TargetProperty } from 'libs/notion/types'

const schema: TargetProperty[] = [
  { name: 'Tags', type: 'multi_select' },
  { name: 'Status', type: 'status' },
  { name: 'Score', type: 'number' },
  { name: 'Note', type: 'rich_text' },
  { name: 'Done', type: 'checkbox' },
]

const reconcile = (properties: FixedProperty[]) =>
  reconcileFixedProperties(properties, schema)

describe('mergeReconciledProperties', () => {
  it('unions multi_select options, always-on values first', () => {
    const merged = mergeReconciledProperties(
      reconcile([{ name: 'Tags', type: 'multi_select', value: ['a', 'b'] }]),
      reconcile([{ name: 'Tags', type: 'multi_select', value: ['b', 'auto'] }]),
    )

    expect(merged.properties.Tags).toEqual({
      multi_select: [{ name: 'a' }, { name: 'b' }, { name: 'auto' }],
    })
  })

  it('overrides single-valued properties with the auto value', () => {
    const merged = mergeReconciledProperties(
      reconcile([
        { name: 'Status', type: 'status', value: 'Inbox' },
        { name: 'Score', type: 'number', value: 1 },
        { name: 'Done', type: 'checkbox', value: false },
        { name: 'Note', type: 'rich_text', value: 'manual' },
      ]),
      reconcile([
        { name: 'Status', type: 'status', value: 'Swept' },
        { name: 'Score', type: 'number', value: 2 },
        { name: 'Done', type: 'checkbox', value: true },
        { name: 'Note', type: 'rich_text', value: 'auto' },
      ]),
    )

    expect(merged.properties).toEqual({
      Status: { status: { name: 'Swept' } },
      Score: { number: 2 },
      Done: { checkbox: true },
      Note: { rich_text: [{ text: { content: 'auto' } }] },
    })
  })

  it('adds auto-only properties and keeps always-on-only ones', () => {
    const merged = mergeReconciledProperties(
      reconcile([{ name: 'Status', type: 'status', value: 'Inbox' }]),
      reconcile([{ name: 'Tags', type: 'multi_select', value: ['auto'] }]),
    )

    expect(merged.properties).toEqual({
      Status: { status: { name: 'Inbox' } },
      Tags: { multi_select: [{ name: 'auto' }] },
    })
  })

  it('is a no-op when the auto set is empty', () => {
    const base = reconcile([{ name: 'Score', type: 'number', value: 7 }])
    const merged = mergeReconciledProperties(base, reconcile([]))

    expect(merged.properties).toEqual(base.properties)
    expect(merged.warnings).toEqual([])
  })

  it('concatenates warnings from both sets', () => {
    const merged = mergeReconciledProperties(
      reconcile([{ name: 'Gone', type: 'select', value: 'x' }]),
      reconcile([{ name: 'Score', type: 'status', value: 'x' }]),
    )

    expect(merged.properties).toEqual({})
    expect(merged.warnings).toHaveLength(2)
    expect(merged.warnings[0]).toContain('"Gone"')
    expect(merged.warnings[1]).toContain('"Score"')
  })
})
