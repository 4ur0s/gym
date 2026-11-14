import { useEffect, useState } from 'react'

export const parseNum = (s: string): number | null => {
  const t = s.replace(',', '.').replace(/[^\d.+-]/g, '')
  if (t === '' || t === '-' || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Numeric input with the iOS decimal keyboard; commits on every valid change */
export function NumField({ value, onCommit, className = 'field', placeholder, allowEmpty = false, ariaLabel }: {
  value: number | null | undefined
  onCommit: (v: number | null) => void
  className?: string
  placeholder?: string
  allowEmpty?: boolean
  ariaLabel?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(value == null ? '' : String(value)) }, [value, focused])
  return (
    <input
      className={className}
      inputMode="decimal"
      enterKeyHint="done"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => { setFocused(true); e.currentTarget.select() }}
      onBlur={() => { setFocused(false); setText(value == null ? '' : String(value)) }}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseNum(e.target.value)
        if (n != null) onCommit(n)
        else if (allowEmpty && e.target.value.trim() === '') onCommit(null)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}
