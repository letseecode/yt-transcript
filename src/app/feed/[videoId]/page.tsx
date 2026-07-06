'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function FeedVideoPage() {
  const params = useParams()
  const videoId = params.videoId as string
  const [summary, setSummary] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading')
  const [moving, setMoving] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  useEffect(() => {
    setState('loading')
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.summary) {
          setSummary(d.summary)
          setState('ready')
        } else {
          setState('none')
        }
      })
      .catch(() => setState('error'))
  }, [videoId])

  const moveToLibrary = async () => {
    setMoving('busy')
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
      })
      setMoving(res.ok ? 'done' : 'error')
    } catch {
      setMoving('error')
    }
  }

  // TL;DR is the first line; the rest are bullet lines starting with "- ".
  const lines = (summary ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const tldr = lines.find((l) => !l.startsWith('- '))
  const bullets = lines.filter((l) => l.startsWith('- ')).map((l) => l.replace(/^-\s*/, ''))

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="border-b-2 border-ink bg-white sticky top-0 z-10">
        <div className="relative">
          <div className="w-full pl-[0.8cm] pr-0 py-[22px] flex items-center gap-0">
            <Link
              href="/"
              className="relative font-serif font-bold text-[1.837rem] text-black hover:text-purple hover:[text-shadow:0.0245em_0.021em_0_rgba(78,0,255,0.4)] transition-[color,text-shadow] duration-150 -translate-y-[3px]"
            >
              YourTranscript
              <span className="absolute left-0 right-0 bottom-[2px] h-[3.3px] bg-purple [box-shadow:2px_1.5px_0_rgba(78,0,255,0.3)] pointer-events-none" />
            </Link>
            <span className="w-0 border-l-2 border-ink self-stretch -my-[22px] ml-[0.8cm]" />
            <span className="flex-1 h-0 border-t-2 border-ink self-center" />
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 right-[9.3px] flex items-center gap-[9.5px]">
            <Link href="/feed" className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white transition-colors">
              Feed
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto px-6 pt-8 pb-16" style={{ maxWidth: '52rem' }}>
        {/* Embedded player */}
        <div className="relative w-full border-2 border-black" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={moveToLibrary}
            disabled={moving === 'busy' || moving === 'done'}
            className={`font-headline font-bold uppercase text-sm border-2 border-ink px-4 py-2 transition-colors ${
              moving === 'done' ? 'bg-mint text-black' : 'bg-white text-black hover:bg-mint'
            }`}
          >
            {moving === 'busy' ? 'Transcribing…' : moving === 'done' ? 'In library ✓' : moving === 'error' ? 'Failed — retry' : 'Move to library'}
          </button>
          {moving === 'done' && (
            <Link href={`/transcript/${videoId}`} className="font-headline text-sm underline hover:text-purple">
              Open transcript →
            </Link>
          )}
        </div>

        {/* AI summary */}
        <section className="mt-10">
          <h2 className="font-headline font-bold uppercase text-[1.05rem] tracking-wide mb-4">Summary</h2>
          {state === 'loading' && <p className="font-body text-muted">Summarizing…</p>}
          {state === 'none' && <p className="font-body text-muted">No captions available for this video, so there’s nothing to summarize.</p>}
          {state === 'error' && <p className="font-body text-red">Couldn’t generate a summary. Try again later.</p>}
          {state === 'ready' && (
            <div className="space-y-4">
              {tldr && <p className="font-serif text-lg leading-relaxed italic">{tldr}</p>}
              {bullets.length > 0 && (
                <ul className="space-y-2 list-disc pl-6">
                  {bullets.map((b, i) => (
                    <li key={i} className="font-serif leading-relaxed">{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
