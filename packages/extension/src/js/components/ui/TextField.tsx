import React from 'react'
import { useAppTheme } from 'libs/appTheme'
import IconButton from 'components/ui/IconButton'
import {
  VisibilityOffRoundedIcon,
  VisibilityRoundedIcon,
} from 'icons/materialIcons'

export interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  /** Password variant: masked input with a show/hide toggle. */
  password?: boolean
  placeholder?: string
  disabled?: boolean
  autoComplete?: string
  'aria-label'?: string
  style?: React.CSSProperties
  'data-testid'?: string
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  /** Extra props merged onto the underlying <input> (e.g. combobox wiring). */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  /** Ref to the underlying <input> (e.g. combobox wiring). */
  inputRef?: React.Ref<HTMLInputElement>
}

/**
 * Local text input primitive matching the other `components/ui/` controls
 * (same border/focus treatment as the numeric input in SettingsDialog).
 */
export default function TextField({
  value,
  onChange,
  password = false,
  placeholder,
  disabled = false,
  autoComplete,
  'aria-label': ariaLabel,
  style,
  'data-testid': testId,
  onKeyDown,
  inputProps,
  inputRef,
}: TextFieldProps) {
  const theme = useAppTheme()
  const [focused, setFocused] = React.useState(false)
  const [revealed, setRevealed] = React.useState(false)
  const type = password && !revealed ? 'password' : 'text'

  return (
    <div
      className="relative inline-flex w-full items-center"
      style={{ height: 36, ...style }}
      data-testid={testId}
    >
      <input
        {...inputProps}
        ref={inputRef}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          inputProps?.onKeyDown?.(event)
          onKeyDown?.(event)
        }}
        onFocus={(event) => {
          setFocused(true)
          inputProps?.onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          inputProps?.onBlur?.(event)
        }}
        spellCheck={false}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid',
          borderColor: focused
            ? theme.palette.primary.main
            : 'var(--input-border, rgba(0,0,0,0.23))',
          borderRadius: 4,
          padding: '4px 8px',
          paddingRight: password ? 36 : 8,
          fontSize: '0.92rem',
          background: 'transparent',
          color: 'inherit',
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {password && (
        <IconButton
          aria-label={revealed ? 'Hide value' : 'Show value'}
          onClick={() => setRevealed((current) => !current)}
          disabled={disabled}
          style={{
            position: 'absolute',
            right: 2,
            width: 30,
            height: 30,
            padding: 0,
          }}
        >
          {revealed ? (
            <VisibilityOffRoundedIcon fontSize={18} />
          ) : (
            <VisibilityRoundedIcon fontSize={18} />
          )}
        </IconButton>
      )}
    </div>
  )
}
