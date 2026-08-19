import React from 'react'
import { observer } from 'mobx-react-lite'
import { browser } from 'libs'
import Dialog, { DialogTitle, DialogContent } from 'components/ui/Dialog'
import Switch from 'components/ui/Switch'
import { useStore } from 'components/hooks/useStore'
import {
  type ActionTabCountMode,
  ACTION_TAB_COUNT_MODES,
} from 'libs/actionTabCount'
import { type WindowOrder, WINDOW_ORDERS } from 'libs/windowOrder'
import Slider from 'components/ui/Slider'
import IconButton from 'components/ui/IconButton'
import { ToggleGroup, ToggleButton } from 'components/ui/ToggleGroup'
import { useAppTheme } from 'libs/appTheme'
import {
  AddRoundedIcon,
  DarkModeRoundedIcon,
  DesktopWindowsRoundedIcon,
  LightModeRoundedIcon,
  RemoveRoundedIcon,
} from 'icons/materialIcons'
import useReduceMotion from 'libs/useReduceMotion'
import { getUiColorTokens } from 'libs/uiColorTokens'
import { defaultTransitionDuration } from 'libs/transition'
import TextField from 'components/ui/TextField'
import { useCombobox } from 'components/ui/Combobox'
import type { FixedProperty, TargetProperty } from 'libs/notion/types'
import type { ContentDepth } from 'stores/UserStore'
import SponsorButton from './SponsorButton'
import FeedbackButton from './FeedbackButton'
import TabRowPreview from './TabRowPreview'

/* -------------------------------------------------------------------------- */
/*  Inline style helpers (replacing MUI sx / Typography / FormHelperText)       */
/* -------------------------------------------------------------------------- */

const panelTitleStyle: React.CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  lineHeight: 1.3,
  margin: 0,
}

const panelDescriptionStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: '0.8rem',
  lineHeight: 1.45,
  opacity: 0.7,
  margin: 0,
}

const controlTitleStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 600,
  lineHeight: 1.35,
  margin: 0,
}

const controlDescriptionStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: '0.76rem',
  lineHeight: 1.45,
  opacity: 0.7,
  margin: 0,
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

const SettingsPanel = ({
  title,
  description,
  children,
  style,
  testId,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  style: React.CSSProperties
  testId?: string
  className?: string
}) => (
  <div
    className={`rounded-xl border p-4 ${className || ''}`}
    style={style}
    data-testid={testId}
  >
    <div className="mb-3">
      <h4 style={panelTitleStyle}>{title}</h4>
      {description && <p style={panelDescriptionStyle}>{description}</p>}
    </div>
    {children}
  </div>
)

const PreviewSurface = ({
  children,
  style,
  testId,
}: {
  children: React.ReactNode
  style: React.CSSProperties
  testId?: string
}) => (
  <div
    data-testid={testId}
    aria-hidden="true"
    className="w-full min-w-0 overflow-hidden rounded-lg border xl:min-w-72"
    style={style}
  >
    {children}
  </div>
)

const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const themeOptions = [
  {
    value: 'system',
    label: 'System',
    icon: DesktopWindowsRoundedIcon,
  },
  {
    value: 'light',
    label: 'Light',
    icon: LightModeRoundedIcon,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: DarkModeRoundedIcon,
  },
] as const

const uiPresetOptions = [
  {
    value: 'modern',
    label: 'Modern',
  },
  {
    value: 'classic',
    label: 'Classic',
  },
] as const

const actionTabCountOptions: {
  value: ActionTabCountMode
  label: string
}[] = ACTION_TAB_COUNT_MODES.map((value) => ({
  value,
  label:
    value === 'currentWindow'
      ? 'Window'
      : value === 'allWindows'
        ? 'All'
        : 'Off',
}))

const windowOrderOptions: {
  value: WindowOrder
  label: string
}[] = WINDOW_ORDERS.map((value) => ({
  value,
  label: value === 'lastUsed' ? 'Last used' : 'Default',
}))

const DensityControl = ({
  title,
  description,
  value,
  min,
  max,
  step,
  unit,
  defaultValue,
  sliderAriaLabel,
  inputAriaLabel,
  decrementAriaLabel,
  incrementAriaLabel,
  onChange,
  style,
  testId,
}: {
  title: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  defaultValue: number
  sliderAriaLabel: string
  inputAriaLabel: string
  decrementAriaLabel: string
  incrementAriaLabel: string
  onChange: (value: number) => void
  style: React.CSSProperties
  testId?: string
}) => {
  const [draftValue, setDraftValue] = React.useState(String(value))

  React.useEffect(() => {
    setDraftValue(String(value))
  }, [value])

  const commitValue = (nextValue: number) => {
    const clampedValue = clampValue(nextValue, min, max)
    setDraftValue(String(clampedValue))
    if (clampedValue !== value) {
      onChange(clampedValue)
    }
  }

  const commitDraftValue = () => {
    if (!draftValue) {
      setDraftValue(String(value))
      return
    }
    const parsedValue = Number.parseInt(draftValue, 10)
    if (Number.isNaN(parsedValue)) {
      setDraftValue(String(value))
      return
    }
    commitValue(parsedValue)
  }

  return (
    <div
      className="rounded-lg border px-3 py-3"
      style={style}
      data-testid={testId}
    >
      <div
        className={
          description
            ? 'flex flex-col gap-3'
            : 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between'
        }
      >
        <div className="min-w-0">
          <h5 style={controlTitleStyle}>{title}</h5>
          {description && <p style={controlDescriptionStyle}>{description}</p>}
        </div>
        <div className="flex items-center gap-0.5 self-start md:shrink-0">
          <IconButton
            aria-label={decrementAriaLabel}
            onClick={() => commitValue(value - step)}
            style={{ width: 30, height: 30, padding: 0 }}
          >
            <RemoveRoundedIcon fontSize={18} />
          </IconButton>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              width: 92,
              height: 36,
            }}
          >
            <input
              type="text"
              value={draftValue}
              onChange={(event) => {
                const sanitizedValue = event.target.value.replace(/[^\d]/g, '')
                setDraftValue(sanitizedValue)
                if (!sanitizedValue) {
                  return
                }
                const parsedValue = Number.parseInt(sanitizedValue, 10)
                if (
                  Number.isNaN(parsedValue) ||
                  parsedValue < min ||
                  parsedValue > max
                ) {
                  return
                }
                if (parsedValue !== value) {
                  onChange(parsedValue)
                }
              }}
              onBlur={commitDraftValue}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitDraftValue()
                  ;(event.currentTarget as HTMLInputElement).blur()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setDraftValue(String(value))
                  ;(event.currentTarget as HTMLInputElement).blur()
                }
              }}
              aria-label={inputAriaLabel}
              inputMode="numeric"
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid',
                borderColor: 'var(--input-border, rgba(0,0,0,0.23))',
                borderRadius: 4,
                padding: '4px 8px',
                paddingRight: unit ? 32 : 8,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '0.92rem',
                background: 'transparent',
                color: 'inherit',
                outline: 'none',
              }}
            />
            {unit && (
              <span
                style={{
                  position: 'absolute',
                  right: 8,
                  fontSize: '0.82rem',
                  opacity: 0.7,
                  pointerEvents: 'none',
                }}
              >
                {unit}
              </span>
            )}
          </div>
          <IconButton
            aria-label={incrementAriaLabel}
            onClick={() => commitValue(value + step)}
            style={{ width: 30, height: 30, padding: 0 }}
          >
            <AddRoundedIcon fontSize={18} />
          </IconButton>
        </div>
      </div>
      <Slider
        value={value}
        step={step}
        min={min}
        max={max}
        marks={[
          { value: min, label: unit ? `${min}${unit}` : String(min) },
          { value: defaultValue, label: 'Default' },
          { value: max, label: unit ? `${max}${unit}` : String(max) },
        ]}
        onChange={(_, nextValue) => {
          if (typeof nextValue !== 'number') {
            return
          }
          setDraftValue(String(nextValue))
          onChange(nextValue)
        }}
        aria-label={sliderAriaLabel}
        style={{
          marginTop: 20,
          marginLeft: 20,
          marginRight: 20,
          marginBottom: 8,
        }}
      />
    </div>
  )
}

const RowDetailsOption = ({
  title,
  description,
  checked,
  onChange,
  preview,
  previewHint,
  style,
  testId,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: () => void
  preview: React.ReactNode
  previewHint?: string
  style: React.CSSProperties
  testId?: string
}) => (
  <div
    data-testid={testId}
    className="flex flex-col gap-3 rounded-lg border px-3 py-3 xl:flex-row xl:items-center xl:gap-4"
    style={style}
  >
    <div className="min-w-0 xl:w-64 xl:shrink-0">
      <div
        className={`flex justify-between gap-3 ${
          description ? 'items-start' : 'items-center'
        }`}
      >
        <h5 style={controlTitleStyle}>{title}</h5>
        <Switch
          checked={checked}
          onChange={onChange}
          inputProps={{ 'aria-label': title }}
        />
      </div>
      {description && <p style={controlDescriptionStyle}>{description}</p>}
    </div>
    <div className="min-w-0 xl:flex-1">
      {preview}
      {previewHint && (
        <p
          style={{
            ...controlDescriptionStyle,
            marginTop: 6,
            fontSize: '0.74rem',
          }}
        >
          {previewHint}
        </p>
      )}
    </div>
  </div>
)

const SettingsSwitchOption = ({
  title,
  description,
  checked,
  onChange,
  style,
  testId,
  containerAriaLabelledBy,
  containerAriaLabel,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: () => void
  style: React.CSSProperties
  testId?: string
  containerAriaLabelledBy?: string
  containerAriaLabel?: string
}) => {
  const switchId = React.useId()
  const titleId = React.useId()
  const descriptionId = React.useId()
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null

    if (target?.closest('label')) {
      return
    }

    onChange()
  }

  return (
    <div
      data-testid={testId}
      className={`flex cursor-pointer justify-between gap-3 rounded-lg border px-3 transition-shadow focus-within:ring-2 focus-within:ring-sky-500/35 ${
        description ? 'items-center py-3.5' : 'items-center py-3'
      }`}
      style={{
        ...style,
        minHeight: 36,
      }}
      aria-labelledby={containerAriaLabelledBy}
      aria-label={containerAriaLabel}
      onClick={handleContainerClick}
    >
      <label htmlFor={switchId} className="min-w-0 pr-3 cursor-pointer">
        <h5 id={titleId} style={controlTitleStyle}>
          {title}
        </h5>
        {description && (
          <p id={descriptionId} style={controlDescriptionStyle}>
            {description}
          </p>
        )}
      </label>
      <Switch
        size="small"
        checked={checked}
        onChange={onChange}
        inputProps={{
          id: switchId,
          'aria-label': title,
          'aria-labelledby': titleId,
          'aria-describedby': description ? descriptionId : undefined,
        }}
        style={{
          marginTop: 0,
          marginRight: -4,
          flexShrink: 0,
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Notion tab archive panel                                                   */
/* -------------------------------------------------------------------------- */

const inlineButtonStyle: React.CSSProperties = {
  border: '1px solid var(--input-border, rgba(0,0,0,0.23))',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: '0.85rem',
  fontWeight: 600,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
}

const selectControlStyle: React.CSSProperties = {
  border: '1px solid var(--input-border, rgba(0,0,0,0.23))',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: '0.8rem',
  background: 'transparent',
  color: 'inherit',
  maxWidth: '100%',
}

/** Default value for a newly added fixed-property row, per property type. */
const defaultFixedValue = (
  property: TargetProperty,
): FixedProperty['value'] => {
  switch (property.type) {
    case 'checkbox':
      return true
    case 'number':
      return 0
    case 'multi_select':
      return []
    default:
      return ''
  }
}

/**
 * Editor for static property values applied to every archived page.
 * Property names come from the resolved target's real schema. For select and
 * multi_select the user may also type a value that does not exist yet — Notion
 * creates the option on write (status cannot, so it stays options-only).
 * Spec: openspec/specs/archive-settings/spec.md
 */
const FixedPropertiesEditor = observer(
  ({ rowStyle }: { rowStyle: React.CSSProperties }) => {
    const { notionStore } = useStore()
    const { editableProperties, fixedProperties } = notionStore

    const schemaFor = (name: string) =>
      editableProperties.find((property) => property.name === name)

    const commit = (rows: FixedProperty[]) => {
      void notionStore.setFixedProperties(rows)
    }

    const updateRow = (index: number, patch: Partial<FixedProperty>) => {
      const rows = fixedProperties.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      )
      commit(rows)
    }

    const removeRow = (index: number) => {
      commit(fixedProperties.filter((_, i) => i !== index))
    }

    const addRow = () => {
      const unused = editableProperties.find(
        (property) =>
          !fixedProperties.some((row) => row.name === property.name),
      )
      if (!unused) {
        return
      }
      commit([
        ...fixedProperties,
        {
          name: unused.name,
          type: unused.type as FixedProperty['type'],
          value: defaultFixedValue(unused),
        },
      ])
    }

    const renderValueControl = (row: FixedProperty, index: number) => {
      const schema = schemaFor(row.name)
      const options = schema?.options || []
      if (row.type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={Boolean(row.value)}
            aria-label={`Value for ${row.name}`}
            onChange={(event) =>
              updateRow(index, { value: event.target.checked })
            }
          />
        )
      }
      if (row.type === 'number') {
        return (
          <input
            type="number"
            value={String(row.value ?? '')}
            aria-label={`Value for ${row.name}`}
            style={{ ...selectControlStyle, width: 110 }}
            onChange={(event) =>
              updateRow(index, { value: Number(event.target.value) })
            }
          />
        )
      }
      if (row.type === 'status') {
        // Notion cannot create status options on write — existing only.
        return (
          <select
            value={String(row.value ?? '')}
            aria-label={`Value for ${row.name}`}
            style={selectControlStyle}
            onChange={(event) =>
              updateRow(index, { value: event.target.value })
            }
          >
            <option value="">— pick —</option>
            {options.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        )
      }
      if (row.type === 'select' || row.type === 'multi_select') {
        // Free text + datalist of existing options: a value that does not exist
        // yet is created by Notion on write. multi_select takes a comma list.
        const listId = `notion-fixed-options-${index}`
        const text = Array.isArray(row.value)
          ? row.value.join(', ')
          : String(row.value ?? '')
        return (
          <>
            <input
              type="text"
              value={text}
              list={listId}
              aria-label={`Value for ${row.name}`}
              placeholder={
                row.type === 'multi_select' ? 'value, another value' : 'value'
              }
              style={{ ...selectControlStyle, minWidth: 140 }}
              onChange={(event) =>
                updateRow(index, {
                  value:
                    row.type === 'multi_select'
                      ? event.target.value
                          .split(',')
                          .map((part) => part.trim())
                          .filter(Boolean)
                      : event.target.value,
                })
              }
            />
            <datalist id={listId}>
              {options.map((option) => (
                <option key={option.name} value={option.name} />
              ))}
            </datalist>
          </>
        )
      }
      return (
        <input
          type="text"
          value={String(row.value ?? '')}
          aria-label={`Value for ${row.name}`}
          style={{ ...selectControlStyle, minWidth: 140 }}
          onChange={(event) => updateRow(index, { value: event.target.value })}
        />
      )
    }

    const canAdd = editableProperties.some(
      (property) => !fixedProperties.some((row) => row.name === property.name),
    )

    return (
      <div className="rounded-lg border px-3 py-3" style={rowStyle}>
        <h5 style={controlTitleStyle}>Fixed properties</h5>
        <p style={controlDescriptionStyle}>
          Values set on every archived page, on top of title and URL. A select
          or tag value that does not exist yet is created in Notion on the first
          archive.
        </p>
        {editableProperties.length === 0 && (
          <p style={{ ...controlDescriptionStyle, marginTop: 8 }}>
            This database has no properties of a supported type (select, status,
            tags, checkbox, number, text).
          </p>
        )}
        <div className="mt-3 space-y-2">
          {fixedProperties.map((row, index) => (
            <div
              key={`${row.name}-${index}`}
              className="flex flex-wrap items-center gap-2"
              data-testid="notion-fixed-property-row"
            >
              <select
                value={row.name}
                aria-label="Fixed property name"
                style={selectControlStyle}
                onChange={(event) => {
                  const next = schemaFor(event.target.value)
                  if (!next) {
                    return
                  }
                  updateRow(index, {
                    name: next.name,
                    type: next.type as FixedProperty['type'],
                    value: defaultFixedValue(next),
                  })
                }}
              >
                {editableProperties.map((property) => (
                  <option key={property.name} value={property.name}>
                    {property.name} ({property.type})
                  </option>
                ))}
              </select>
              {renderValueControl(row, index)}
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Remove fixed property ${row.name}`}
                style={{ ...inlineButtonStyle, padding: '4px 10px' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={addRow}
            className="mt-3"
            style={inlineButtonStyle}
            data-testid="notion-add-fixed-property"
          >
            Add property
          </button>
        )}
      </div>
    )
  },
)

/** Host access needed to read page content out of the archived tab. */
const CONTENT_CAPTURE_PERMISSIONS = {
  permissions: ['scripting'],
  origins: ['http://*/*', 'https://*/*'],
}

/**
 * "How much of the page to keep" control. Switching to rich capture asks for
 * the optional scripting + host permission from inside the click handler (a
 * user gesture is required); declining reverts to bookmark-only.
 * Spec: openspec/specs/page-content-capture/spec.md
 */
const ContentDepthControl = observer(
  ({ rowStyle }: { rowStyle: React.CSSProperties }) => {
    const { userStore } = useStore()
    const [permissionError, setPermissionError] = React.useState<string | null>(
      null,
    )

    const choose = async (next: ContentDepth) => {
      setPermissionError(null)
      if (next === userStore.contentDepth) {
        return
      }
      if (next === 'bookmark') {
        userStore.selectContentDepth('bookmark')
        return
      }
      try {
        const granted = await browser.permissions.request(
          CONTENT_CAPTURE_PERMISSIONS,
        )
        if (!granted) {
          setPermissionError(
            'Page access was declined — keeping link-only archiving.',
          )
          return
        }
        userStore.selectContentDepth('rich')
      } catch (e) {
        setPermissionError(
          e instanceof Error ? e.message : 'Could not request page access.',
        )
      }
    }

    return (
      <div
        className="rounded-lg border px-3 py-3"
        style={rowStyle}
        data-testid="notion-content-depth-control"
      >
        <h5 style={controlTitleStyle}>Page content</h5>
        <p style={controlDescriptionStyle}>
          Keeping the page text needs permission to read the pages you archive.
          Link-only never reads page content.
        </p>
        <div className="mt-3">
          <ToggleGroup
            value={userStore.contentDepth}
            onChange={(next) => void choose(next as ContentDepth)}
            aria-label="Page content depth"
          >
            <ToggleButton value="bookmark">Link only</ToggleButton>
            <ToggleButton value="rich">Link + page content</ToggleButton>
          </ToggleGroup>
        </div>
        {permissionError && (
          <p
            style={{
              ...controlDescriptionStyle,
              marginTop: 8,
              color: '#e5484d',
              opacity: 1,
            }}
          >
            {permissionError}
          </p>
        )}
      </div>
    )
  },
)

const NotionArchivePanel = observer(
  ({
    panelStyle,
    rowStyle,
  }: {
    panelStyle: React.CSSProperties
    rowStyle: React.CSSProperties
  }) => {
    const { notionStore, userStore } = useStore()
    const {
      connection,
      target,
      verifying,
      verifyError,
      searchResults,
      searching,
      searchError,
      mappingHint,
      isConfigured,
    } = notionStore
    const {
      staleThresholdHours,
      updateStaleThresholdHours,
      autoArchiveEnabled,
      toggleAutoArchiveEnabled,
      autoArchiveMaxPerRun,
      updateAutoArchiveMaxPerRun,
      excludePinnedTabs,
      toggleExcludePinnedTabs,
      excludeGroupedTabs,
      toggleExcludeGroupedTabs,
      excludedDomains,
      updateExcludedDomains,
      extractSuspendedTabUrl,
      toggleExtractSuspendedTabUrl,
    } = userStore
    const [tokenDraft, setTokenDraft] = React.useState('')
    const [pickerInput, setPickerInput] = React.useState(target?.title || '')
    const [pickerOpen, setPickerOpen] = React.useState(false)

    // Debounced database search while the picker is open.
    React.useEffect(() => {
      if (!pickerOpen || !connection) {
        return undefined
      }
      const handle = setTimeout(() => {
        void notionStore.searchDatabases(pickerInput)
      }, 300)
      return () => clearTimeout(handle)
    }, [pickerOpen, pickerInput, connection, notionStore])

    React.useEffect(() => {
      setPickerInput(target?.title || '')
    }, [target?.title])

    const items = searchResults.slice()
    const {
      getRootProps,
      getInputProps,
      getListboxProps,
      getItemProps,
      highlightedIndex,
    } = useCombobox<(typeof items)[number]>({
      items,
      inputValue: pickerInput,
      onInputValueChange: setPickerInput,
      onSelect: (item) => {
        setPickerOpen(false)
        setPickerInput(item.title)
        void notionStore.selectTarget(item.dataSourceId)
      },
      isOpen: pickerOpen,
      onOpenChange: setPickerOpen,
    })

    const comboboxInputProps = getInputProps()

    const handleVerify = async () => {
      const verified = await notionStore.verifyToken(tokenDraft.trim())
      if (verified) {
        setTokenDraft('')
      }
    }

    return (
      <SettingsPanel
        testId="settings-panel-notion-archive"
        title="Notion tab archive"
        description="Archive stale tabs as pages in a Notion database, then close them."
        style={panelStyle}
        className="xl:order-5 xl:col-span-3"
      >
        <div className="space-y-3">
          <div className="rounded-lg border px-3 py-3" style={rowStyle}>
            <h5 style={controlTitleStyle}>Notion connection</h5>
            <p style={controlDescriptionStyle}>
              Paste an internal-integration token. It is stored on this device
              only and used exclusively by the background worker.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <TextField
                value={tokenDraft}
                onChange={setTokenDraft}
                password
                placeholder={
                  connection ? 'Token saved — paste to replace' : 'ntn_…'
                }
                autoComplete="off"
                aria-label="Notion integration token"
                data-testid="notion-token-field"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleVerify()
                  }
                }}
              />
              <button
                type="button"
                style={{ ...inlineButtonStyle, opacity: verifying ? 0.6 : 1 }}
                disabled={verifying || (!tokenDraft.trim() && !connection)}
                onClick={() => void handleVerify()}
                data-testid="notion-verify-button"
              >
                {verifying ? 'Verifying…' : 'Verify'}
              </button>
            </div>
            {connection && !verifyError && (
              <p style={{ ...controlDescriptionStyle, marginTop: 8 }}>
                Connected as “{connection.botName}”.
              </p>
            )}
            {verifyError && (
              <p
                style={{
                  ...controlDescriptionStyle,
                  marginTop: 8,
                  color: '#e5484d',
                  opacity: 1,
                }}
              >
                {verifyError}
              </p>
            )}
            <div
              className="mt-3"
              ref={
                getRootProps().ref as unknown as React.RefObject<HTMLDivElement>
              }
            >
              <h5 style={controlTitleStyle}>Archive database</h5>
              <div className="relative mt-2">
                <TextField
                  value={pickerInput}
                  onChange={(nextValue) => {
                    setPickerInput(nextValue)
                    if (!pickerOpen) {
                      setPickerOpen(true)
                    }
                  }}
                  inputRef={comboboxInputProps.ref}
                  inputProps={{
                    onKeyDown: comboboxInputProps.onKeyDown,
                    onFocus: comboboxInputProps.onFocus,
                    onBlur: comboboxInputProps.onBlur,
                    role: comboboxInputProps.role,
                    'aria-activedescendant':
                      comboboxInputProps['aria-activedescendant'],
                    'aria-autocomplete':
                      comboboxInputProps['aria-autocomplete'],
                    'aria-expanded': comboboxInputProps['aria-expanded'],
                  }}
                  disabled={!connection}
                  placeholder={
                    connection
                      ? 'Search databases shared with the integration…'
                      : 'Verify the token first'
                  }
                  aria-label="Archive database"
                  data-testid="notion-database-picker"
                />
                {pickerOpen && connection && (
                  <div
                    {...getListboxProps()}
                    className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border p-1"
                    style={{
                      ...rowStyle,
                      backgroundColor:
                        (rowStyle.backgroundColor as string) || 'inherit',
                    }}
                  >
                    {searching && (
                      <div className="px-2 py-1.5 text-sm opacity-70">
                        Searching…
                      </div>
                    )}
                    {!searching && items.length === 0 && (
                      <div className="px-2 py-1.5 text-sm opacity-70">
                        No databases found — share one with the integration.
                      </div>
                    )}
                    {!searching &&
                      items.map((item, index) => (
                        <div
                          key={item.dataSourceId}
                          {...getItemProps({ index, item })}
                          className="cursor-pointer rounded px-2 py-1.5 text-sm"
                          style={{
                            background:
                              highlightedIndex === index
                                ? 'rgba(125, 125, 125, 0.18)'
                                : 'transparent',
                          }}
                        >
                          {item.title}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {target && (
                <p style={{ ...controlDescriptionStyle, marginTop: 8 }}>
                  {mappingHint}
                </p>
              )}
              {searchError && (
                <p
                  style={{
                    ...controlDescriptionStyle,
                    marginTop: 8,
                    color: '#e5484d',
                    opacity: 1,
                  }}
                >
                  {searchError}
                </p>
              )}
            </div>
          </div>
          <DensityControl
            testId="notion-stale-threshold-control"
            title="Staleness threshold"
            description="Tabs untouched for longer than this are proposed for archiving."
            value={staleThresholdHours}
            min={1}
            max={72}
            step={1}
            unit="h"
            defaultValue={3}
            sliderAriaLabel="Update Staleness Threshold"
            inputAriaLabel="Staleness Threshold Value"
            decrementAriaLabel="Decrease Staleness Threshold"
            incrementAriaLabel="Increase Staleness Threshold"
            onChange={updateStaleThresholdHours}
            style={rowStyle}
          />
          <SettingsSwitchOption
            testId="notion-exclude-pinned-switch"
            title="Never archive pinned tabs"
            description="Keep pinned tabs out of the proposed list, in both manual and automatic mode."
            checked={excludePinnedTabs}
            onChange={toggleExcludePinnedTabs}
            style={rowStyle}
          />
          <div className="rounded-lg border px-3 py-3" style={rowStyle}>
            <h5 style={controlTitleStyle}>Excluded domains</h5>
            <p style={controlDescriptionStyle}>
              One per line. Tabs on these domains, and their subdomains, are
              never archived — by any route.
            </p>
            <textarea
              value={excludedDomains}
              onChange={(event) => updateExcludedDomains(event.target.value)}
              rows={3}
              spellCheck={false}
              aria-label="Excluded domains"
              data-testid="notion-excluded-domains"
              placeholder={'app.notion.com\nmail.google.com'}
              className="mt-3 w-full"
              style={{
                border: '1px solid var(--input-border, rgba(0,0,0,0.23))',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: '0.8rem',
                fontFamily: 'inherit',
                background: 'transparent',
                color: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
          <SettingsSwitchOption
            testId="notion-extract-suspended-switch"
            title="Tab Suspender compatibility: extract URL"
            description="Recover the real page behind a suspended/parked tab so it can still be archived. Page content is not read from such tabs."
            checked={extractSuspendedTabUrl}
            onChange={toggleExtractSuspendedTabUrl}
            style={rowStyle}
          />
          <SettingsSwitchOption
            testId="notion-exclude-grouped-switch"
            title="Never archive grouped tabs"
            description="Keep tabs that belong to a tab group out of the proposed list, in both manual and automatic mode."
            checked={excludeGroupedTabs}
            onChange={toggleExcludeGroupedTabs}
            style={rowStyle}
          />
          <div
            style={
              isConfigured ? undefined : { opacity: 0.5, pointerEvents: 'none' }
            }
            aria-disabled={!isConfigured}
            className="space-y-3"
          >
            <FixedPropertiesEditor rowStyle={rowStyle} />
            <ContentDepthControl rowStyle={rowStyle} />
            <SettingsSwitchOption
              testId="notion-auto-archive-switch"
              title="Auto-archive stale tabs"
              description="Archive stale tabs unattended every 30 minutes. Active, audible, and recently archived tabs are never touched, plus whatever the exclusions above cover."
              checked={autoArchiveEnabled}
              onChange={toggleAutoArchiveEnabled}
              style={rowStyle}
            />
            <DensityControl
              testId="notion-auto-archive-cap-control"
              title="Max tabs per auto run"
              value={autoArchiveMaxPerRun}
              min={1}
              max={25}
              step={1}
              defaultValue={5}
              sliderAriaLabel="Update Auto Archive Cap"
              inputAriaLabel="Auto Archive Cap Value"
              decrementAriaLabel="Decrease Auto Archive Cap"
              incrementAriaLabel="Increase Auto Archive Cap"
              onChange={updateAutoArchiveMaxPerRun}
              style={rowStyle}
            />
          </div>
        </div>
      </SettingsPanel>
    )
  },
)

/* -------------------------------------------------------------------------- */
/*  Main SettingsDialog                                                        */
/* -------------------------------------------------------------------------- */

export default observer(() => {
  const { userStore } = useStore()
  const muiTheme = useAppTheme()
  const {
    dialogOpen,
    closeDialog,
    highlightDuplicatedTab,
    toggleHighlightDuplicatedTab,
    highlightActiveTabsInAllWindows,
    toggleHighlightActiveTabsInAllWindows,
    increaseContrast,
    toggleIncreaseContrast,
    showTabTooltip,
    toggleShowTabTooltip,
    preserveSearch,
    togglePreserveSearch,
    searchHistory,
    toggleSearchHistory,
    showSearchResultMenu,
    toggleShowSearchResultMenu,
    showAppWindow,
    toggleShowAppWindow,
    showUnmatchedTab,
    toggleShowUnmatchedTab,
    autoFitColumns,
    toggleAutoFitColumns,
    litePopupMode,
    toggleLitePopupMode,
    showShortcutHint,
    toggleShowShortcutHint,
    toolbarAutoHide,
    toggleAutoHide,
    showUrl,
    toggleShowUrl,
    autoFocusSearch,
    toggleAutoFocusSearch,
    tabWidth,
    updateTabWidth,
    fontSize,
    updateFontSize,
    showTabIcon,
    toggleShowTabIcon,
    actionTabCountMode,
    selectActionTabCountMode,
    windowOrder,
    selectWindowOrder,
    uiPreset,
    selectUiPreset,
    theme,
    selectTheme,
  } = userStore
  const reduceMotion = useReduceMotion()
  const isDarkMode = muiTheme.mode === 'dark'
  const uiColors = getUiColorTokens(isDarkMode, uiPreset, increaseContrast)
  const panelStyle: React.CSSProperties = {
    backgroundColor: uiColors.settingsPanelSurface,
    borderColor: isDarkMode
      ? increaseContrast
        ? 'rgba(238, 241, 245, 0.28)'
        : 'rgba(238, 241, 245, 0.14)'
      : increaseContrast
        ? 'rgba(100, 116, 139, 0.42)'
        : 'rgba(148, 163, 184, 0.26)',
  }
  const rowDetailOptionStyle: React.CSSProperties = {
    backgroundColor: uiColors.settingsRowSurface,
    borderColor: isDarkMode
      ? increaseContrast
        ? 'rgba(238, 241, 245, 0.24)'
        : 'rgba(238, 241, 245, 0.1)'
      : increaseContrast
        ? 'rgba(100, 116, 139, 0.38)'
        : 'rgba(148, 163, 184, 0.22)',
  }
  const previewSurfaceStyle: React.CSSProperties = {
    backgroundColor: uiColors.settingsPreviewSurface,
    borderColor: isDarkMode
      ? increaseContrast
        ? 'rgba(238, 241, 245, 0.26)'
        : 'rgba(238, 241, 245, 0.12)'
      : increaseContrast
        ? 'rgba(100, 116, 139, 0.4)'
        : 'rgba(148, 163, 184, 0.24)',
  }

  const toggleGroupPillStyle: React.CSSProperties = {
    backgroundColor: isDarkMode
      ? increaseContrast
        ? 'rgba(15, 23, 42, 0.66)'
        : 'rgba(15, 23, 42, 0.44)'
      : increaseContrast
        ? 'rgba(203, 213, 225, 0.86)'
        : 'rgba(226, 232, 240, 0.7)',
    border: `1px solid ${rowDetailOptionStyle.borderColor}`,
  }

  const selectedPillStyle: React.CSSProperties = {
    color: muiTheme.palette.text.primary,
    backgroundColor: isDarkMode
      ? increaseContrast
        ? 'rgba(216, 228, 247, 0.2)'
        : 'rgba(255, 255, 255, 0.12)'
      : 'rgba(255, 255, 255, 0.96)',
    boxShadow: isDarkMode
      ? increaseContrast
        ? 'inset 0 0 0 1px rgba(238, 241, 245, 0.22)'
        : 'inset 0 0 0 1px rgba(238, 241, 245, 0.08)'
      : increaseContrast
        ? '0 1px 2px rgba(15, 23, 42, 0.18), inset 0 0 0 1px rgba(100, 116, 139, 0.28)'
        : '0 1px 2px rgba(15, 23, 42, 0.14)',
  }

  const unselectedPillStyle: React.CSSProperties = {
    color: increaseContrast
      ? uiColors.mutedText
      : muiTheme.palette.text.secondary,
    backgroundColor: 'transparent',
  }

  return (
    <Dialog
      open={dialogOpen}
      fullWidth
      maxWidth="lg"
      disableRestoreFocus
      transitionDuration={reduceMotion ? 1 : defaultTransitionDuration}
      onClose={closeDialog}
      style={{
        backgroundColor: uiColors.settingsDialogSurface,
        backgroundImage: 'none',
        color: muiTheme.palette.text.primary,
      }}
    >
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <div className="grid gap-3 py-1 lg:grid-cols-2 xl:grid-cols-3">
          <SettingsPanel
            testId="settings-panel-search"
            title="Search"
            description="Control how search starts and what stays visible while filtering."
            style={panelStyle}
          >
            <div className="space-y-3">
              <SettingsSwitchOption
                testId="settings-search-preserve"
                title="Preserve search"
                checked={preserveSearch}
                onChange={togglePreserveSearch}
                style={rowDetailOptionStyle}
              />
              <SettingsSwitchOption
                testId="settings-search-focus"
                title="Focus search on open"
                checked={autoFocusSearch}
                onChange={toggleAutoFocusSearch}
                style={rowDetailOptionStyle}
              />
              <SettingsSwitchOption
                testId="settings-search-history"
                title="Include browser history in results"
                checked={searchHistory}
                onChange={toggleSearchHistory}
                style={rowDetailOptionStyle}
              />
              <SettingsSwitchOption
                testId="settings-search-result-menu"
                title="Show result menu in full-page view"
                description="Show matching tabs below search when Tab Manager is open in its own browser tab. Commands always remain available."
                checked={showSearchResultMenu}
                onChange={toggleShowSearchResultMenu}
                style={rowDetailOptionStyle}
              />
              <SettingsSwitchOption
                title="Keep non-matching tabs visible"
                description="Keep unmatched tabs in view while you search."
                checked={showUnmatchedTab}
                onChange={toggleShowUnmatchedTab}
                style={rowDetailOptionStyle}
              />
            </div>
          </SettingsPanel>
          <SettingsPanel
            testId="settings-panel-theme-density"
            title="Appearance"
            description="Adjust theme, reading size, and layout density."
            style={panelStyle}
          >
            <div className="space-y-3">
              <div
                className="rounded-lg border px-3 py-3"
                style={rowDetailOptionStyle}
                data-testid="settings-ui-preset-toggle-group"
              >
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <h5 style={controlTitleStyle}>Interface style</h5>
                    <p style={controlDescriptionStyle}>
                      Switch between the current UI and the pre-2.0-inspired
                      Classic mode.
                    </p>
                  </div>
                  <ToggleGroup
                    value={uiPreset}
                    aria-label="Choose interface style"
                    onChange={(nextPreset) => {
                      if (!nextPreset) {
                        return
                      }
                      selectUiPreset(nextPreset as 'modern' | 'classic')
                    }}
                    style={toggleGroupPillStyle}
                  >
                    {uiPresetOptions.map((option) => (
                      <ToggleButton
                        key={option.value}
                        value={option.value}
                        aria-label={`Use ${option.value} interface style`}
                        style={{
                          minWidth: 72,
                          ...(uiPreset === option.value
                            ? selectedPillStyle
                            : unselectedPillStyle),
                        }}
                      >
                        {option.label}
                      </ToggleButton>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
              <div
                className="rounded-lg border px-3 py-3"
                style={rowDetailOptionStyle}
                data-testid="settings-theme-toggle-group"
              >
                <div className="flex items-center justify-between gap-3">
                  <h5 style={controlTitleStyle}>Theme</h5>
                  <ToggleGroup
                    value={theme}
                    aria-label="Choose theme"
                    onChange={(nextTheme) => {
                      if (!nextTheme) {
                        return
                      }
                      selectTheme(nextTheme)
                    }}
                    style={toggleGroupPillStyle}
                  >
                    {themeOptions.map((option) => (
                      <ToggleButton
                        key={option.value}
                        value={option.value}
                        aria-label={`Use ${option.value} theme`}
                        style={{
                          paddingLeft: 5,
                          paddingRight: 5,
                          ...(theme === option.value
                            ? selectedPillStyle
                            : unselectedPillStyle),
                        }}
                      >
                        <option.icon fontSize={16} />
                      </ToggleButton>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
              <SettingsSwitchOption
                testId="settings-increase-contrast"
                title="Increase contrast"
                description="Make toolbars, buttons, controls, and muted details easier to see."
                checked={increaseContrast}
                onChange={toggleIncreaseContrast}
                style={rowDetailOptionStyle}
              />
              <DensityControl
                testId="settings-font-size-control"
                title="Font size"
                value={fontSize}
                min={6}
                max={36}
                step={1}
                defaultValue={14}
                sliderAriaLabel="Update Font Size"
                inputAriaLabel="Font Size Value"
                decrementAriaLabel="Decrease Font Size"
                incrementAriaLabel="Increase Font Size"
                onChange={updateFontSize}
                style={rowDetailOptionStyle}
              />
              <DensityControl
                testId="settings-tab-width-control"
                title="Minimum tab width"
                description="Affects window columns and cards; wider values make titles easier to scan."
                value={tabWidth}
                min={15}
                max={50}
                step={1}
                defaultValue={20}
                sliderAriaLabel="Update Tab Width"
                inputAriaLabel="Minimum Tab Width Value"
                decrementAriaLabel="Decrease Minimum Tab Width"
                incrementAriaLabel="Increase Minimum Tab Width"
                onChange={updateTabWidth}
                style={rowDetailOptionStyle}
              />
            </div>
          </SettingsPanel>
          <SettingsPanel
            testId="settings-panel-behavior"
            title="View"
            description="Choose which windows and popup controls stay visible."
            style={panelStyle}
            className="xl:order-3"
          >
            <div className="space-y-3">
              <SettingsSwitchOption
                title="Show app windows in list"
                description="Include standalone app windows in the main list."
                checked={showAppWindow}
                onChange={toggleShowAppWindow}
                style={rowDetailOptionStyle}
              />
              <SettingsSwitchOption
                title="Use lite popup mode"
                description="Use the lite layout for the browser action popup window only."
                checked={litePopupMode}
                onChange={toggleLitePopupMode}
                style={rowDetailOptionStyle}
                testId="settings-lite-popup-mode"
              />
              <div
                className="rounded-lg border px-3 py-3"
                style={rowDetailOptionStyle}
                data-testid="settings-action-tab-count-toggle-group"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h5 style={controlTitleStyle}>Extension icon count</h5>
                    <p style={controlDescriptionStyle}>
                      Overlay the toolbar icon with a larger tab count for the
                      current window or across all windows.
                    </p>
                  </div>
                  <ToggleGroup
                    value={actionTabCountMode}
                    aria-label="Choose extension icon tab count mode"
                    onChange={(nextMode) => {
                      if (!nextMode) {
                        return
                      }
                      selectActionTabCountMode(nextMode as ActionTabCountMode)
                    }}
                    style={toggleGroupPillStyle}
                  >
                    {actionTabCountOptions.map((option) => (
                      <ToggleButton
                        key={option.value}
                        value={option.value}
                        aria-label={`Show extension icon count for ${option.label.toLowerCase()} tabs`}
                        style={{
                          minWidth: 54,
                          ...(actionTabCountMode === option.value
                            ? selectedPillStyle
                            : unselectedPillStyle),
                        }}
                      >
                        {option.label}
                      </ToggleButton>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
              <SettingsSwitchOption
                title="Auto-fit columns"
                description="Avoid horizontal scrolling by fitting columns to the window."
                checked={autoFitColumns}
                onChange={toggleAutoFitColumns}
                style={rowDetailOptionStyle}
              />
              <div
                className="rounded-lg border px-3 py-3"
                style={rowDetailOptionStyle}
                data-testid="settings-window-order-toggle-group"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h5 style={controlTitleStyle}>Window order</h5>
                    <p style={controlDescriptionStyle}>
                      Choose the default browser order or place recently used
                      windows first.
                    </p>
                  </div>
                  <ToggleGroup
                    value={windowOrder}
                    aria-label="Choose window order"
                    onChange={(nextWindowOrder) => {
                      if (!nextWindowOrder) {
                        return
                      }
                      selectWindowOrder(nextWindowOrder as WindowOrder)
                    }}
                    style={toggleGroupPillStyle}
                  >
                    {windowOrderOptions.map((option) => (
                      <ToggleButton
                        key={option.value}
                        value={option.value}
                        aria-label={`Use ${option.label.toLowerCase()} window order`}
                        style={{
                          minWidth: 78,
                          ...(windowOrder === option.value
                            ? selectedPillStyle
                            : unselectedPillStyle),
                        }}
                      >
                        {option.label}
                      </ToggleButton>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
              <SettingsSwitchOption
                title="Show shortcut hints"
                description="Show the shortcut and its action when a shortcut is pressed."
                checked={showShortcutHint}
                onChange={toggleShowShortcutHint}
                style={rowDetailOptionStyle}
              />
              <SettingsSwitchOption
                title="Keep toolbar visible"
                description="Always show the bottom-right toolbar."
                checked={!toolbarAutoHide}
                onChange={toggleAutoHide}
                style={rowDetailOptionStyle}
                containerAriaLabelledBy="toggle-always-show-toolbar"
                containerAriaLabel="Toggle Always Show Toolbar"
              />
            </div>
          </SettingsPanel>
          <SettingsPanel
            testId="settings-panel-tab-display"
            title="Tab display"
            description="Choose which details each tab shows."
            style={panelStyle}
            className="xl:order-4 xl:col-span-3"
          >
            <div className="space-y-3" data-testid="row-details-options">
              <RowDetailsOption
                testId="row-details-option-active-tabs"
                title="Highlight all active tabs"
                checked={highlightActiveTabsInAllWindows}
                onChange={toggleHighlightActiveTabsInAllWindows}
                style={rowDetailOptionStyle}
                preview={
                  <PreviewSurface
                    style={previewSurfaceStyle}
                    testId="row-details-preview-active-tabs"
                  >
                    <TabRowPreview
                      config={{
                        id: 9100,
                        title: 'Active tab in inactive window',
                        url: 'https://github.com/xcv58/Tab-Manager-v2/issues/2635',
                        active: true,
                        lastFocused: false,
                        uiPreset,
                        increaseContrast,
                        highlightActiveTabsInAllWindows,
                        showDuplicateMarker: false,
                        showTabIcon: true,
                        showUrl: true,
                        showTabTooltip: false,
                      }}
                    />
                  </PreviewSurface>
                }
              />
              <RowDetailsOption
                testId="row-details-option-duplicates"
                title="Mark duplicate tabs"
                checked={highlightDuplicatedTab}
                onChange={toggleHighlightDuplicatedTab}
                style={rowDetailOptionStyle}
                preview={
                  <PreviewSurface
                    style={previewSurfaceStyle}
                    testId="row-details-preview-duplicates"
                  >
                    <TabRowPreview
                      config={{
                        id: 9101,
                        title: 'Tab Manager issue tracker',
                        url: 'https://github.com/xcv58/Tab-Manager-v2/issues/2580',
                        duplicatedTabCount: 2,
                        uiPreset,
                        increaseContrast,
                        showDuplicateMarker: highlightDuplicatedTab,
                        showTabIcon: true,
                        showUrl: true,
                        showTabTooltip: false,
                      }}
                    />
                  </PreviewSurface>
                }
              />
              <RowDetailsOption
                testId="row-details-option-icons"
                title="Show tab icons"
                checked={showTabIcon}
                onChange={toggleShowTabIcon}
                style={rowDetailOptionStyle}
                previewHint="Hover preview to inspect controls."
                preview={
                  <PreviewSurface
                    style={previewSurfaceStyle}
                    testId="row-details-preview-icons"
                  >
                    <TabRowPreview
                      config={{
                        id: 9102,
                        title: 'Tab Manager settings dialog',
                        url: 'https://github.com/xcv58/Tab-Manager-v2',
                        uiPreset,
                        increaseContrast,
                        showDuplicateMarker: false,
                        showTabIcon,
                        showUrl: true,
                        showTabTooltip: false,
                      }}
                    />
                  </PreviewSurface>
                }
              />
              <RowDetailsOption
                testId="row-details-option-urls"
                title="Show URLs"
                checked={showUrl}
                onChange={toggleShowUrl}
                style={rowDetailOptionStyle}
                preview={
                  <PreviewSurface
                    style={previewSurfaceStyle}
                    testId="row-details-preview-urls"
                  >
                    <TabRowPreview
                      config={{
                        id: 9103,
                        title: 'Preview URLs inside settings',
                        url: 'https://github.com/xcv58/Tab-Manager-v2/issues/2580',
                        uiPreset,
                        increaseContrast,
                        showDuplicateMarker: false,
                        showTabIcon: true,
                        showUrl,
                        showTabTooltip: false,
                      }}
                    />
                  </PreviewSurface>
                }
              />
              <RowDetailsOption
                testId="row-details-option-tooltips"
                title="Show tab tooltips"
                checked={showTabTooltip}
                onChange={toggleShowTabTooltip}
                style={rowDetailOptionStyle}
                previewHint="Hover preview to open the tooltip."
                preview={
                  <PreviewSurface
                    style={previewSurfaceStyle}
                    testId="row-details-preview-tooltips"
                  >
                    <TabRowPreview
                      config={{
                        id: 9104,
                        title: 'Hover this preview tab for tooltip details',
                        url: 'https://github.com/xcv58/Tab-Manager-v2/issues/2580',
                        duplicatedTabCount: 2,
                        uiPreset,
                        increaseContrast,
                        showDuplicateMarker: false,
                        showTabIcon: true,
                        showUrl: false,
                        showTabTooltip,
                      }}
                    />
                  </PreviewSurface>
                }
              />
            </div>
          </SettingsPanel>
          <NotionArchivePanel
            panelStyle={panelStyle}
            rowStyle={rowDetailOptionStyle}
          />
        </div>
        <div
          className="mt-6 flex items-center justify-between border-t pt-4"
          style={{ borderColor: panelStyle.borderColor }}
        >
          <div className="flex items-center gap-2 opacity-80">
            <SponsorButton />
            <FeedbackButton />
          </div>
          <div className="text-sm text-right opacity-65">
            v{browser.runtime.getManifest().version}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
