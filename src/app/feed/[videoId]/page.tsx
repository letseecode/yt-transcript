'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const DISMISS_KEY = 'feed-dismissed'

export default function FeedVideoPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.videoId as string
  const [summary, setSummary] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'none' | 'error'>('idle')
  const [sending, setSending] = useState<'idle' | 'busy' | 'error'>('idle')

  const askAI = async () => {
    setState('loading')
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })
      const d = await res.json()
      if (d.summary) {
        setSummary(d.summary)
        setState('ready')
      } else {
        setState('none')
      }
    } catch {
      setState('error')
    }
  }

  const sendToLibrary = async () => {
    setSending('busy')
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
      })
      if (!res.ok) {
        setSending('error')
        return
      }
      // In the library now -- drop it from the feed and go back there.
      try {
        const set = new Set<string>(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'))
        set.add(videoId)
        localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]))
      } catch {}
      router.push('/feed')
    } catch {
      setSending('error')
    }
  }

  const handleDelete = () => {
    try {
      const set = new Set<string>(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'))
      set.add(videoId)
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]))
    } catch {}
    router.push('/feed')
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
              className="relative font-headline font-bold text-[1.837rem] text-black hover:text-purple hover:[text-shadow:0.0245em_0.021em_0_rgba(78,0,255,0.4)] transition-[color,text-shadow] duration-150 -translate-y-[3px]"
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
        {/* Embedded player, in the thick purple box with a right shadow. */}
        <div
          className="relative w-full border-[10px] border-purple [box-shadow:12px_12px_0_rgba(78,0,255,0.3)]"
          style={{ paddingBottom: '56.25%' }}
        >
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Ask AI + Send to library */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            {state === 'idle' && (
              <button
                onClick={askAI}
                className="font-headline font-bold uppercase text-sm border-2 border-ink bg-white text-black px-5 py-2 hover:bg-mint transition-colors"
              >
                Ask AI
              </button>
            )}
            <button
              onClick={sendToLibrary}
              disabled={sending === 'busy'}
              className="font-headline font-bold uppercase text-sm border-2 border-ink bg-white text-black px-5 py-2 hover:bg-purple hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black"
            >
              {sending === 'busy' ? 'Sending…' : sending === 'error' ? 'Failed — try again' : 'Send to library'}
            </button>
          </div>
          {state === 'loading' && <p className="font-body text-muted mt-4">Thinking…</p>}
          {state === 'none' && <p className="font-body text-muted">No captions available for this video, so there’s nothing to summarize.</p>}
          {state === 'error' && (
            <button onClick={askAI} className="font-headline font-bold uppercase text-sm border-2 border-ink bg-white text-black px-5 py-2 hover:bg-mint transition-colors">
              Couldn’t answer — try again
            </button>
          )}
          {state === 'ready' && (
            <div className="space-y-4 mt-6">
              <h2 className="font-headline font-bold uppercase text-[1.05rem] tracking-wide">Summary</h2>
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

        {/* Delete (dismiss from feed), styled like the transcript-page delete. */}
        <div className="mt-16 pt-8 border-t border-black flex justify-center">
          <button
            onClick={handleDelete}
            className="group inline-flex items-center gap-[0.575rem] border-2 border-ink bg-transparent px-[1.4375rem] py-[0.575rem] text-[1.006rem] font-headline uppercase tracking-wide text-black hover:bg-trash hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Delete video
          </button>
        </div>
      </main>
    </div>
  )
}
