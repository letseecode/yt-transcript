'use client'

import { useRef } from 'react'

interface SpeakerBlockProps {
  speakerKey: string
  displayName: string
  text: string
  startMs: number
  onRename: (newName: string) => void
}

const speakerAccents: Record<string, string> = {
  A: 'border-red',
  B: 'border-ink',
  C: 'border-yellow',
  D: 'border-muted',
}

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SpeakerBlock({
  speakerKey,
  displayName,
  text,
  startMs,
  onRename,
}: SpeakerBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const accent = speakerAccents[speakerKey] ?? 'border-border'

  return (
    <div className={`border-l-4 ${accent} pl-5 py-1`}>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 group">
          <input
            ref={inputRef}
            defaultValue={displayName}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) onRename(v)
              else e.target.value = displayName
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                e.currentTarget.value = displayName
                e.currentTarget.blur()
              }
            }}
            title="Click to rename this speaker"
            className="font-headline font-bold uppercase text-xs tracking-widest text-muted bg-transparent outline-none border-b border-transparent focus:border-muted hover:border-muted cursor-pointer transition-colors max-w-xs"
          />
          <span className="text-muted opacity-0 group-hover:opacity-100 text-xs transition-opacity select-none" aria-hidden>
            ✎
          </span>
        </div>
        <time className="text-muted text-xs font-body tabular-nums shrink-0">
          {formatTime(startMs)}
        </time>
      </div>
      <p className="font-serif text-base leading-relaxed text-ink">{text}</p>
    </div>
  )
}
