'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Segment {
  text: string
  startMs: number
}

export default function TranscriptPage() {
  const params = useParams()
  const id = params.id as string

  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`transcript-${id}`)
      if (raw) {
        setSegments(JSON.parse(raw))
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    }
    setLoading(false)
  }, [id])

  const buildExportText = () =>
    segments.map((s) => s.text).join('\n\n')

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

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-headline text-xl font-bold">Transcript not found.</p>
        <p className="font-body text-sm text-muted">This link only works in the same browser that generated the transcript.</p>
        <Link href="/" className="font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors">
          ← Transcribe a new video
        </Link>
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

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-4">
        {segments.map((seg, i) => (
          <p key={i} className="font-serif text-[1.125rem] leading-[1.6] text-ink">
            {seg.text}
          </p>
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
