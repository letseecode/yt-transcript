'use client'

import { useEffect, useRef, useState } from 'react'

export const THEMES = {
  white: { label: 'White', bg: '#FFFFFF', text: '#1A1A1A', shadow: 'rgba(0,0,0,0.15)' },
  sepia: { label: 'Sepia', bg: '#F4ECD8', text: '#4A3728', shadow: 'rgba(0,0,0,0.15)' },
  paper: { label: 'Paper', bg: '#E6E4E1', text: '#1A1A1A', shadow: 'rgba(0,0,0,0.15)' },
  dark: { label: 'Dark', bg: '#1A1A1A', text: '#F7F2ED', shadow: 'rgba(255,255,255,0.3)' },
  carbon: { label: 'Carbon', bg: '#000000', text: '#E0DAD3', shadow: 'rgba(255,255,255,0.3)' },
} as const

// The swatch grid is 8 fixed slots: row 1 is White / Paper / Sepia / (empty,
// was Dawn -- left open for a future theme), row 2 is Dark / Carbon / (empty) / (empty).
export const THEME_SLOTS: (ThemeKey | null)[] = ['white', 'paper', 'sepia', null, 'dark', 'carbon', null, null]

export const FONTS = {
  serif: { label: 'Serif', family: 'var(--font-serif-family), serif' },
  sans: { label: 'Sans', family: 'var(--font-body-family), sans-serif' },
  headline: { label: 'Headline', family: 'var(--font-headline-family), sans-serif' },
  mono: { label: 'Mono', family: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
} as const

// One smaller step added at the front of size/spacing; one wider step
// added at the end of width. Defaults below keep the same visual result
// as before by shifting their index to match.
export const SIZE_STEPS = [0.875, 1, 1.125, 1.25, 1.375, 1.5]
export const SPACING_STEPS = [1.2, 1.4, 1.6, 1.8, 2]
export const WIDTH_STEPS = ['38rem', '44rem', '50rem', '56rem', '62rem']

export type ThemeKey = keyof typeof THEMES
export type FontKey = keyof typeof FONTS

export interface ReadingPrefs {
  theme: ThemeKey
  font: FontKey
  sizeIdx: number
  spacingIdx: number
  widthIdx: number
}

const DEFAULT_PREFS: ReadingPrefs = { theme: 'white', font: 'serif', sizeIdx: 2, spacingIdx: 2, widthIdx: 1 }
const STORAGE_KEY = 'reading-prefs'

export function useReadingPrefs() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }))
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {}
  }, [prefs, loaded])

  return [prefs, setPrefs] as const
}

const CONTROL_WIDTH = 'w-[104px]'

function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-headline text-[0.9rem] text-muted">{label}</span>
      <div className={`flex border-2 border-ink ${CONTROL_WIDTH}`}>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className="flex-1 h-9 flex items-center justify-center text-sm hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value === max}
          className="flex-1 h-9 flex items-center justify-center text-base border-l-2 border-ink hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function ReadingSettingsMenu({
  prefs,
  setPrefs,
  onClose,
}: {
  prefs: ReadingPrefs
  setPrefs: (updater: (p: ReadingPrefs) => ReadingPrefs) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-[300px] bg-white border-2 border-ink shadow-[6px_6px_0_rgba(0,0,0,0.15)] p-4 z-30"
    >
      <p className="font-headline text-[0.9rem] text-muted mb-2">Theme</p>
      <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b-2 border-border">
        {THEME_SLOTS.map((key, i) =>
          key === null ? (
            <div key={`empty-${i}`} className="h-10 border-2 border-dashed border-border" />
          ) : (
            <button
              key={key}
              onClick={() => setPrefs((p) => ({ ...p, theme: key }))}
              className="h-10 border-2 text-[0.7rem] font-headline"
              style={{
                background: THEMES[key].bg,
                color: THEMES[key].text,
                borderColor: prefs.theme === key ? '#4E00FF' : '#E0DAD3',
              }}
            >
              {THEMES[key].label}
            </button>
          )
        )}
      </div>

      <div className="flex items-center justify-between py-2 border-b-2 border-border">
        <span className="font-headline text-[0.9rem] text-muted">Font</span>
        <select
          value={prefs.font}
          onChange={(e) => setPrefs((p) => ({ ...p, font: e.target.value as FontKey }))}
          className={`reading-select border-2 border-ink px-2 py-1 text-sm font-body bg-white ${CONTROL_WIDTH}`}
        >
          {(Object.keys(FONTS) as FontKey[]).map((key) => (
            <option key={key} value={key}>
              {FONTS[key].label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-b-2 border-border">
        <Stepper
          label="Font size"
          value={prefs.sizeIdx}
          max={SIZE_STEPS.length - 1}
          onChange={(v) => setPrefs((p) => ({ ...p, sizeIdx: v }))}
        />
      </div>
      <div className="border-b-2 border-border">
        <Stepper
          label="Spacing"
          value={prefs.spacingIdx}
          max={SPACING_STEPS.length - 1}
          onChange={(v) => setPrefs((p) => ({ ...p, spacingIdx: v }))}
        />
      </div>
      <Stepper
        label="Width"
        value={prefs.widthIdx}
        max={WIDTH_STEPS.length - 1}
        onChange={(v) => setPrefs((p) => ({ ...p, widthIdx: v }))}
      />
    </div>
  )
}
