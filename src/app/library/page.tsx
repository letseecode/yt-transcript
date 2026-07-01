'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TranscriptSummary {
  videoId: string
  url: string
  title: string
  author: string
  createdAt: string
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
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink bg-cream sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="font-headline font-bold text-base uppercase tracking-tight hover:text-red transition-colors">
            YT Transcript
          </Link>
          <span className="text-border select-none">/</span>
          <span className="font-body text-sm text-muted">Library</span>
          <Link
            href="/"
            className="ml-auto font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors"
          >
            New transcript
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <h1 className="font-headline font-bold text-4xl leading-none mb-8">Saved transcripts</h1>

        {loading ? (
          <p className="font-headline text-lg font-bold">Loading…</p>
        ) : items.length === 0 ? (
          <div className="space-y-3">
            <p className="font-body text-base text-muted">No transcripts saved yet.</p>
            <Link
              href="/"
              className="inline-block font-headline font-bold uppercase tracking-wide text-xs border-2 border-ink px-4 py-2 hover:bg-yellow transition-colors"
            >
              Transcribe your first video →
            </Link>
          </div>
        ) : (
          <ul className="divide-y-2 divide-border border-y-2 border-ink">
            {items.map((item) => (
              <li key={item.videoId}>
                <Link
                  href={`/transcript/${item.videoId}`}
                  className="block py-4 group hover:bg-surface transition-colors"
                >
                  <p className="font-serif text-lg leading-snug text-ink group-hover:text-red transition-colors">
                    {item.title || item.videoId}
                  </p>
                  <p className="font-body text-sm text-muted mt-1">
                    {item.author && <span>{item.author} · </span>}
                    {new Date(item.createdAt).toLocaleDateString()}
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
