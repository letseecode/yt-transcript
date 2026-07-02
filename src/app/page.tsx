'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValidYoutubeUrl = (value: string) =>
    value.includes('youtube.com') || value.includes('youtu.be')

  const handleSubmit = async () => {
    setError('')

    if (!url.trim()) {
      setError('Paste a YouTube URL first.')
      return
    }

    if (!isValidYoutubeUrl(url)) {
      setError("That doesn't look like a YouTube URL.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (data.id && data.segments) {
        try {
          localStorage.setItem(
            `transcript-${data.id}`,
            JSON.stringify({ segments: data.segments, title: data.title ?? '' })
          )
        } catch {}
        router.push(`/transcript/${data.id}`)
      } else {
        setError(data.error ?? 'Something went wrong. Try again.')
        setLoading(false)
      }
    } catch {
      setError('Network error. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink bg-surface sticky top-0 z-10">
        <div className="max-w-5xl ml-0 mr-auto pl-[1cm] pr-6 py-3 flex items-center gap-3">
          <a
            href="/"
            className="font-serif text-[1.66rem] text-black underline decoration-purple decoration-2 underline-offset-4 hover:text-purple transition-colors"
          >
            Your Transcript
          </a>
          <span className="font-serif text-[1.66rem] text-muted select-none">//</span>
          <span className="font-serif text-[1.55rem] text-muted">Read instead of listen</span>
          <a
            href="/library"
            className="ml-auto font-serif text-[1.27rem] bg-mint text-black border-2 border-ink px-3 py-1.5 hover:bg-paper transition-colors"
          >
            Library
          </a>
        </div>
      </header>

      <section className="border-b-2 border-ink bg-surface text-ink">
        <div className="max-w-5xl ml-0 mr-auto pl-[1cm] pr-6 pt-8 md:pt-10 pb-8 md:pb-10">
          <p className="font-headline uppercase tracking-wide text-[0.825rem] text-muted mb-4 md:mb-6">
            Full Transcripts · Your Own Library&nbsp;&nbsp;//&nbsp;&nbsp;Podcasts · Interviews · Investor Calls
          </p>
          <h1 className="font-display text-[clamp(2.75rem,7.5vw,9.5rem)] leading-[0.95] tracking-tight">
            Paste a{' '}
            <span className="relative inline-block">Link<span className="absolute left-0 right-0 -bottom-[6px] md:-bottom-[10px] h-[9px] md:h-[15px] bg-purple" /></span>
            ;
            <br />
            <span className="inline-block whitespace-nowrap">
              <span className="text-purple">Read</span> the whole thing.
            </span>
          </h1>
        </div>
      </section>

      <section className="max-w-5xl ml-0 mr-auto w-full px-6 py-12 bg-paper">
        <div className="max-w-[50.4rem] space-y-3">
          <label className="font-serif text-[1.275rem] text-black block">
            YouTube URL
          </label>
          <div className="flex border-2 border-ink">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
              className="flex-1 bg-surface px-4 py-6 outline-none font-body text-base placeholder:text-muted"
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center justify-center bg-ink text-cream font-serif text-[1.4rem] border-l-[12px] border-l-black px-6 hover:bg-mint hover:text-black active:bg-mint active:text-black transition-colors duration-100 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Fetching…' : 'Transcribe →'}
            </button>
          </div>

          {error && (
            <p className="text-red text-sm font-body">{error}</p>
          )}
        </div>
      </section>

      <section className="border-t-2 border-ink mt-auto">
        <div className="max-w-5xl ml-0 mr-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              label: 'Auto captions',
              body: 'Reads the captions YouTube already generated — instant, no audio processing needed.',
            },
            {
              label: 'Timestamped',
              body: 'Every paragraph is linked to where it appears in the video.',
            },
            {
              label: 'Export',
              body: 'Copy to clipboard or download as a plain .txt file.',
            },
          ].map(({ label, body }) => (
            <div key={label}>
              <p className="font-headline font-bold text-sm uppercase tracking-wide mb-1">{label}</p>
              <p className="font-body text-sm text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
