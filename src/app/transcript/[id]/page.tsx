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
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    const readLocal = (): boolean => {
      try {
        const raw = localStorage.getItem(`transcript-${id}`)
        if (!raw) return false
        const parsed = JSON.parse(raw)
        // Older saves stored a bare array; newer ones store { segments, title }.
        const segs = Array.isArray(parsed) ? parsed : parsed.segments
        if (!segs) return false
        if (!cancelled) {
          setSegments(segs)
          setTitle(Array.isArray(parsed) ? '' : parsed.title ?? '')
        }
        return true
      } catch {
        return false
      }
    }

    const load = async () => {
      // Try the database first (shareable, works on any device).
      try {
        const res = await fetch(`/api/transcript/${id}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setSegments(data.segments)
            setTitle(data.title ?? '')
            setLoading(false)
          }
          return
        }
      } catch {}

      // Fall back to this browser's local copy.
      if (readLocal()) {
        if (!cancelled) setLoading(false)
        return
      }

      if (!cancelled) {
        setNotFound(true)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
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
        <p className="font-body text-sm text-muted">This transcript may have been removed, or the link is incorrect.</p>
        <Link href="/" className="font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors">
          ← Transcribe a new video
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative border-b-2 border-ink bg-surface sticky top-0 z-10">
        <div className="w-full pl-[0.8cm] pr-0 py-[22px] flex items-center gap-0">
          <Link
            href="/"
            className="relative font-serif text-[1.597rem] text-black hover:text-purple hover:[text-shadow:0.0245em_0.021em_0_rgba(120,120,120,0.54)] transition-[color,text-shadow] duration-150 -translate-y-[3px]"
          >
            YourTranscript
            <span className="absolute left-0 right-0 bottom-[2px] h-[3.3px] bg-purple [box-shadow:2px_1.5px_0_rgba(78,0,255,0.3)] pointer-events-none" />
          </Link>
          <span className="w-0 border-l-2 border-ink self-stretch -my-[22px] ml-[0.8cm]" />
          <span className="flex-1 h-0 border-t-2 border-ink self-center" />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 right-[19px] flex items-center gap-[9.5px]">
          <Link
            href="/library"
            className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white hover:[text-shadow:2px_1.5px_0_rgba(0,0,0,0.4)] transition-colors"
          >
            Library
          </Link>
          <button
            onClick={handleDownload}
            className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white hover:[text-shadow:2px_1.5px_0_rgba(0,0,0,0.4)] transition-colors"
          >
            Download
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-4">
        {title && (
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="font-serif font-bold text-[2.236rem] leading-tight underline decoration-purple decoration-[4.62px] underline-offset-[6px] [text-shadow:0.05em_0.03em_0_rgba(0,0,0,0.15)] text-ink">
              {title}
            </h1>
            <button
              onClick={handleCopy}
              aria-label="Copy transcript"
              title={copied ? 'Copied' : 'Copy transcript'}
              className="group shrink-0 mt-1 p-2"
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {/* Front page (drawn on top) */}
                  <rect x="9" y="9" width="13" height="13" rx="2" className="stroke-black transition-colors group-hover:stroke-purple" />
                  {/* Back page (drawn behind) */}
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" className="stroke-black transition-colors group-hover:stroke-mint" />
                </svg>
              )}
            </button>
          </div>
        )}
        {segments.map((seg, i) => {
          // If the paragraph begins with a short "Name:" label, render that
          // label in bold italic, magazine-interview style.
          const match = seg.text.match(/^([^:]{1,40}):\s+([\s\S]+)$/)
          return (
            <p key={i} className="font-serif text-[1.125rem] leading-[1.6] text-ink">
              {match ? (
                <>
                  <span className="font-bold italic">{match[1]}:</span> {match[2]}
                </>
              ) : (
                seg.text
              )}
            </p>
          )
        })}
      </main>

      <footer className="border-t-2 border-ink">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-body text-sm text-muted hover:text-ink transition-colors">
            ← Transcribe another
          </Link>
        </div>
      </footer>
    </div>
  )
}
