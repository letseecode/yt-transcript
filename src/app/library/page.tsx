'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TranscriptSummary {
  videoId: string
  url: string
  title: string
  author: string
  createdAt: string
  publishedAt: string | null
}

// Prefer the video's own publish date; fall back to when we saved it.
function displayDate(item: TranscriptSummary): string {
  const raw = item.publishedAt || item.createdAt
  const d = new Date(raw)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

export default function LibraryPage() {
  const [items, setItems] = useState<TranscriptSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/transcripts')
        const data = await res.json()
        setItems(data.items ?? [])
      } catch {
        setItems([])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Header adopted from the transcript page: logo + rule, single button. */}
      <header className="border-b-2 border-ink bg-white sticky top-0 z-10">
        <div className="relative">
          <div className="w-full pl-[0.8cm] pr-0 py-[22px] flex items-center gap-0">
            <Link
              href="/"
              className="relative font-serif text-[1.597rem] text-black hover:text-purple hover:[text-shadow:0.0245em_0.021em_0_rgba(78,0,255,0.4)] transition-[color,text-shadow] duration-150 -translate-y-[3px]"
            >
              YourTranscript
              <span className="absolute left-0 right-0 bottom-[2px] h-[3.3px] bg-purple [box-shadow:2px_1.5px_0_rgba(78,0,255,0.3)] pointer-events-none" />
            </Link>
            <span className="w-0 border-l-2 border-ink self-stretch -my-[22px] ml-[0.8cm]" />
            <span className="flex-1 h-0 border-t-2 border-ink self-center" />
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 right-[9.3px] flex items-center gap-[9.5px]">
            <Link
              href="/library"
              className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white transition-colors"
            >
              Library
            </Link>
          </div>
        </div>
      </header>

      {/* Everything here is sized in em off a 1.6rem base, i.e. ~60% larger
          than the previous rem-based sizing. */}
      <main
        className="flex-1 w-full mx-auto px-6 py-16"
        style={{ maxWidth: '68rem', fontSize: '1.6rem' }}
      >
        <div className="relative inline-block mb-[0.9em]">
          <h1 className="font-display uppercase text-[4.16em] leading-[1.0] tracking-tight [text-shadow:0.05em_0.03em_0_rgba(0,0,0,0.16)]">
            Saved Transcripts
          </h1>
          {/* Single mint highlighter line, 50% thicker, with a soft mint shadow. */}
          <span className="absolute left-0 right-0 -bottom-[0.02em] h-[0.1125em] bg-mint [box-shadow:0.05em_0.035em_0_rgba(84,255,201,0.5)] pointer-events-none" />
        </div>

        {/* The separator below the title, in black. */}
        <div className="h-[3px] bg-black [box-shadow:0.13em_0.09em_0_rgba(0,0,0,0.25)]" />

        {loading ? (
          <p className="font-headline text-[1.1em] font-bold mt-[1.2em]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="space-y-[0.8em] mt-[1.2em]">
            <p className="font-body text-[0.9em] text-muted">No transcripts saved yet.</p>
            <Link
              href="/"
              className="inline-block font-headline font-bold uppercase tracking-wide text-[0.65em] border-2 border-ink px-[1.2em] py-[0.7em] hover:bg-mint transition-colors"
            >
              Transcribe your first video →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-black">
            {items.map((item) => (
              <li key={item.videoId}>
                <Link
                  href={`/transcript/${item.videoId}`}
                  className="group block py-[1.1em]"
                >
                  <span className="relative inline-block">
                    <span className="font-serif font-bold text-[1.15em] leading-snug text-black">
                      {item.title || item.videoId}
                    </span>
                    {/* Black highlighter that appears on hover. */}
                    <span className="absolute left-0 right-0 -bottom-[0.06em] h-[0.06em] bg-black opacity-0 group-hover:opacity-100 transition-opacity [box-shadow:0.05em_0.035em_0_rgba(0,0,0,0.3)] pointer-events-none" />
                  </span>
                  <p className="font-body text-[0.8em] mt-[0.5em]">
                    {item.author && <span className="text-muted">{item.author} · </span>}
                    <span className="text-black">{displayDate(item)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
