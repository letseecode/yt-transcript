'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import SpeakerBlock from '@/components/SpeakerBlock'

interface Utterance {
  speaker: string
  text: string
  start: number
  end: number
}

export default function TranscriptPage() {
  const params = useParams()
  const id = params.id as string

  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchTranscript = async () => {
      const res = await fetch(`/api/transcribe/${id}`)
      const data = await res.json()
      const utt: Utterance[] = data.utterances ?? []
      setUtterances(utt)

      const uniqueSpeakers: string[] = Array.from(new Set(utt.map((u) => u.speaker)))

      let saved: Record<string, string> = {}
      try {
        const raw = localStorage.getItem(`names-${id}`)
        if (raw) saved = JSON.parse(raw)
      } catch {}

      const defaults: Record<string, string> = {}
      uniqueSpeakers.forEach((s) => {
        defaults[s] = saved[s] ?? `Speaker ${s}`
      })

      setNames(defaults)
      setLoading(false)
    }

    fetchTranscript()
  }, [id])

  const handleRename = (speakerKey: string, newName: string) => {
    setNames((prev) => {
      const updated = { ...prev, [speakerKey]: newName }
      try { localStorage.setItem(`names-${id}`, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  const buildExportText = () =>
    utterances
      .map((u) => `[${names[u.speaker] ?? `Speaker ${u.speaker}`}]\n${u.text}`)
      .join('\n\n')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildExportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([buildExportText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcript.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-headline text-xl font-bold">Loading transcript…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink bg-cream sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-headline font-bold text-base uppercase tracking-tight hover:text-red transition-colors">
              YT Transcript
            </Link>
            <span className="text-border select-none">/</span>
            <span className="font-body text-sm text-muted">Transcript</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors"
            >
              Download
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-3">
          <p className="font-body text-xs text-muted">
            Click any speaker label to rename it. Press Enter or click away to confirm.
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">
        {utterances.map((u, i) => (
          <SpeakerBlock
            key={i}
            speakerKey={u.speaker}
            displayName={names[u.speaker] ?? `Speaker ${u.speaker}`}
            text={u.text}
            startMs={u.start}
            onRename={(newName) => handleRename(u.speaker, newName)}
          />
        ))}
      </main>

      <footer className="border-t-2 border-ink">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-body text-sm text-muted hover:text-ink transition-colors">
            ← Transcribe another
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy all'}
            </button>
            <button
              onClick={handleDownload}
              className="font-headline font-bold uppercase tracking-wide text-xs bg-ink text-cream px-4 py-2 hover:bg-red transition-colors"
            >
              Download .txt
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
