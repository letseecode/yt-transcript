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
      <header className="border-b-2 border-ink bg-cream sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <span className="font-headline font-bold text-base uppercase tracking-tight">
            YT Transcript
          </span>
          <span className="text-border select-none">/</span>
          <span className="font-body text-sm text-muted">Read instead of listen</span>
          <a
            href="/library"
            className="ml-auto font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors"
          >
            Library
          </a>
        </div>
      </header>

      <section className="border-b-2 border-ink bg-ink text-cream">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <p className="font-headline uppercase tracking-widest text-xs text-muted mb-5">
            Full transcripts · Speaker detection · Free
          </p>
          <h1 className="font-headline font-bold text-5xl md:text-7xl leading-none mb-6 max-w-3xl">
            Paste a link.
            <br />
            <span className="text-yellow">Read</span> the whole thing.
          </h1>
          <p className="font-body text-base md:text-lg text-muted max-w-xl leading-relaxed">
            Speaker detection labels who said what. Rename speakers to real names. Copy or download the full transcript.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto w-full px-6 py-12">
        <div className="max-w-2xl space-y-3">
          <label className="font-headline uppercase tracking-widest text-xs text-muted block">
            YouTube URL
          </label>
          <div className="flex border-2 border-ink">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 bg-surface px-4 py-4 outline-none font-body text-base placeholder:text-muted"
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-ink text-cream font-headline font-bold uppercase tracking-wide px-6 py-4 hover:bg-red transition-colors duration-100 disabled:opacity-50 whitespace-nowrap text-sm"
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
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
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
