'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface FeedVideo {
  videoId: string
  title: string
  channel: string
  publishedAt: string
  thumbnail: string
}

const DISMISS_KEY = 'feed-dismissed'
// Cache the assembled feed for the tab's lifetime, so navigating into a video
// and back (or re-clicking "Feed") shows the same list instantly instead of
// re-running the expensive YouTube assembly. Cleared only by an explicit
// Refresh or a full page reload / new tab.
const FEED_CACHE_KEY = 'feed-cache'
function loadCachedFeed(): FeedVideo[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY)
    return raw ? (JSON.parse(raw) as FeedVideo[]) : null
  } catch {
    return null
  }
}
function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

const ShelfIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4v16M8 5v11M12 5v11M16 6l3 10M20 20H3" />
  </svg>
)
const TrashIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

export default function FeedPage() {
  const [status, setStatus] = useState<'loading' | 'unconfigured' | 'disconnected' | 'connected'>('loading')
  const [items, setItems] = useState<FeedVideo[]>([])
  const [loadingFeed, setLoadingFeed] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [moving, setMoving] = useState<Record<string, 'busy' | 'done' | 'error'>>({})

  useEffect(() => setDismissed(loadDismissed()), [])

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then((r) => r.json())
      .then((d) => {
        if (!d.configured) setStatus('unconfigured')
        else if (!d.connected) setStatus('disconnected')
        else setStatus('connected')
      })
      .catch(() => setStatus('unconfigured'))
  }, [])

  const fetchFeed = () => {
    setLoadingFeed(true)
    fetch('/api/feed')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        const list: FeedVideo[] = d.items ?? []
        setItems(list)
        try {
          sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(list))
        } catch {}
      })
      .catch(() => setItems([]))
      .finally(() => setLoadingFeed(false))
  }

  useEffect(() => {
    if (status !== 'connected') return
    // Same session? Reuse the remembered feed and skip the reload entirely.
    const cached = loadCachedFeed()
    if (cached) {
      setItems(cached)
      return
    }
    fetchFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const refreshFeed = () => {
    try {
      sessionStorage.removeItem(FEED_CACHE_KEY)
    } catch {}
    fetchFeed()
  }

  const dismiss = (videoId: string) => {
    const next = new Set(dismissed)
    next.add(videoId)
    setDismissed(next)
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]))
    } catch {}
  }

  const moveToLibrary = async (videoId: string) => {
    setMoving((m) => ({ ...m, [videoId]: 'busy' }))
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
      })
      if (res.ok) {
        // Once it's in the library, wipe it off the feed.
        setMoving((m) => ({ ...m, [videoId]: 'done' }))
        dismiss(videoId)
      } else {
        setMoving((m) => ({ ...m, [videoId]: 'error' }))
      }
    } catch {
      setMoving((m) => ({ ...m, [videoId]: 'error' }))
    }
  }

  const visible = items.filter((v) => !dismissed.has(v.videoId))

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
            <Link href="/library" className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white transition-colors">
              Library
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto pl-[calc(1.5rem-1%+0.5cm)] pr-6 pt-8 pb-16" style={{ maxWidth: '68rem', fontSize: '1.6rem' }}>
        <div className="relative inline-block mb-[0.9em]">
          <h1 className="font-display text-[clamp(2.655rem,7.957vw,8.845rem)] leading-[1.0] tracking-tight [text-shadow:0.066em_0.036em_0_rgba(0,0,0,0.15)]">
            Feed
          </h1>
          <span className="absolute left-0 right-0 -bottom-[0.026em] h-[0.4557em] bg-mint [box-shadow:0.104em_0.064em_0_rgba(84,255,201,0.625)] pointer-events-none" />
        </div>

        <div style={{ fontSize: '0.8rem' }}>
          {status === 'loading' && <p className="font-headline text-[1.1em] font-bold mt-[1.2em]">Loading…</p>}

          {status === 'unconfigured' && (
            <p className="font-body text-[0.9em] text-muted mt-[1.2em] max-w-[42em]">
              The YouTube connection isn’t configured yet. Add <code>GOOGLE_CLIENT_ID</code> and{' '}
              <code>GOOGLE_CLIENT_SECRET</code> in the deployment’s environment variables to enable it.
            </p>
          )}

          {status === 'disconnected' && (
            <div className="mt-[1.2em] space-y-[0.9em]">
              <p className="font-body text-[0.9em] text-muted max-w-[42em]">
                Connect your Google account to pull your YouTube subscriptions here.
              </p>
              <a href="/api/auth/google" className="inline-block font-headline font-bold uppercase tracking-wide text-[0.8em] border-2 border-ink px-[1.4em] py-[0.7em] hover:bg-mint transition-colors">
                Connect YouTube →
              </a>
            </div>
          )}

          {status === 'connected' && (
            <>
              {loadingFeed ? (
                <p className="font-headline text-[1.1em] font-bold mt-[1.2em]">Loading your feed…</p>
              ) : visible.length === 0 ? (
                <p className="font-body text-[0.9em] text-muted mt-[1.2em]">Nothing new in your feed right now.</p>
              ) : (
                <ul className="divide-y-2 divide-black border-2 border-black">
                  {visible.map((v) => {
                    const state = moving[v.videoId]
                    return (
                      <li key={v.videoId} className="relative group">
                        <Link href={`/feed/${v.videoId}`} className="block py-[1.1em] pl-[1em] pr-[9em]">
                          <span className="font-serif font-bold text-[1.3225em] leading-snug text-black">{v.title}</span>
                          <p className="font-serif text-[0.872em] mt-[0.5em] text-black">
                            {v.channel && <span>{v.channel} · </span>}
                            <span>{new Date(v.publishedAt).toLocaleDateString()}</span>
                          </p>
                        </Link>
                        <div className="absolute right-[1em] top-1/2 -translate-y-1/2 flex items-center gap-[0.6em]">
                          <button
                            onClick={() => moveToLibrary(v.videoId)}
                            disabled={state === 'busy' || state === 'done'}
                            aria-label="Move to library"
                            title={state === 'done' ? 'In library' : state === 'busy' ? 'Transcribing…' : 'Move to library'}
                            className={`inline-flex items-center justify-center w-[2.2em] h-[2.2em] border-2 border-ink text-[1.05em] transition-all ${
                              state === 'done' ? 'bg-mint text-black' : 'bg-white text-black hover:bg-mint'
                            }`}
                          >
                            {state === 'busy' ? '…' : state === 'done' ? '✓' : <ShelfIcon />}
                          </button>
                          <button
                            onClick={() => dismiss(v.videoId)}
                            aria-label="Dismiss"
                            className="inline-flex items-center justify-center w-[2.2em] h-[2.2em] border-2 border-ink bg-white text-black text-[1.05em] opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-trash hover:text-white transition-all"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-[1.5em] text-[0.75em] text-muted">
                <button onClick={refreshFeed} className="underline hover:text-purple">Refresh feed</button>
                <span className="mx-[0.6em]">·</span>
                <a href="/api/auth/google/logout" className="underline hover:text-purple">Disconnect YouTube</a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
