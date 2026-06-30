interface SpeakerBlockProps {
  speakerKey: string
  displayName: string
  text: string
  startMs: number
  onRename: (newName: string) => void
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function SpeakerBlock({
  speakerKey,
  displayName,
  text,
  startMs,
  onRename,
}: SpeakerBlockProps) {
  const borderColor = speakerKey === 'A' ? 'border-red' : 'border-ink'

  return (
    <div className={`border-l-4 ${borderColor} pl-4 py-3`}>
      <div className="flex items-center justify-between mb-1">
        <input
          defaultValue={displayName}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="font-headline uppercase text-xs tracking-widest text-muted bg-transparent outline-none border-b border-transparent focus:border-ink w-auto"
        />
        <span className="text-muted text-xs font-body">
          {formatTime(startMs)}
        </span>
      </div>
      <p className="font-body text-base leading-relaxed">{text}</p>
    </div>
  )
}