'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { countHighlights, clearLocalTranscript, loadProgress } from '@/lib/highlights'

// Title with a purple hover-underline that hugs each wrapped line's text
// (one segment per line), rather than a full-width bar. We measure the text's
// per-line client rects; a fixed 2px height keeps every line's underline the
// exact same thickness (an em-based height rounds to different pixel counts).
function RowTitle({ title }: { title: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [rects, setRects] = useState<{ left: number; width: number; top: number }[]>([])

  useLayoutEffect(() => {
    const measure = () => {
      const el = textRef.current
      const wrap = el?.parentElement
      if (!el || !wrap) return
      const w = wrap.getBoundingClientRect()
      setRects(
        Array.from(el.getClientRects()).map((r) => ({
          left: r.left - w.left,
          width: r.width,
          top: r.bottom - w.top,
        }))
      )
    }
    measure()
    document.fonts?.ready?.then(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [title])

  return (
    <span className="relative inline-block">
      <span ref={textRef} className="font-serif font-bold text-[1.5209em] leading-snug text-black">
        {title}
      </span>
      {rects.map((r, i) => (
        <span
          key={i}
          className="absolute h-[2px] bg-purple opacity-0 group-hover:opacity-100 transition-opacity [box-shadow:0.05em_0.035em_0_rgba(78,0,255,0.3)] pointer-events-none"
          style={{ left: r.left, width: r.width, top: r.top + 1 }}
        />
      ))}
    </span>
  )
}

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

// --- Icons (inline so the strict CSP has nothing external to fetch) --------
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
// A highlighter / brush -- mint fill with a black outline.
const BrushIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="#54FFC9" stroke="#000000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3l6 6-8.5 8.5H6.5V11.5z" />
    <path d="M6.5 17.5 4 22l4.5-2.5" />
  </svg>
)
// A rolled scroll (pergamino) for notes.
const ScrollIcon = () => (
  <svg width="1em" height="1em" {...iconProps}>
    <path d="M6 4h11a2 2 0 0 1 2 2v10a2 2 0 0 0 2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2z" />
    <path d="M5 4a2 2 0 0 0-2 2v1h4" />
    <path d="M10 9h6M10 13h6" />
  </svg>
)
const TrashIcon = () => (
  <svg width="1em" height="1em" {...iconProps}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

// A round pill showing a count + icon (highlights / notes). Clicking it jumps
// straight to that section of the transcript.
function CountBadge({ icon, count, tone, href }: { icon: React.ReactNode; count: number; tone: 'mint' | 'purple'; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-[0.3em] border-2 border-ink bg-white px-[0.7em] h-[2.2em] text-[1.05em] leading-none select-none hover:bg-muted hover:text-white active:bg-[#92908E] active:text-white transition-colors"
    >
      <span className={tone === 'mint' ? '' : 'text-purple'}>{icon}</span>
      <span className="font-serif font-bold">{count}</span>
    </Link>
  )
}

export default function LibraryPage() {
  const [items, setItems] = useState<TranscriptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<string, { highlights: number; notes: number }>>({})
  const [progress, setProgress] = useState<Record<string, number>>({})

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

  // Highlights/notes live in this browser's localStorage; tally them once the
  // list is in.
  useEffect(() => {
    const next: Record<string, { highlights: number; notes: number }> = {}
    const prog: Record<string, number> = {}
    for (const item of items) {
      next[item.videoId] = countHighlights(item.videoId)
      prog[item.videoId] = loadProgress(item.videoId)
    }
    setCounts(next)
    setProgress(prog)
  }, [items])

  const handleDelete = async (videoId: string) => {
    setItems((prev) => prev.filter((i) => i.videoId !== videoId))
    clearLocalTranscript(videoId)
    try {
      await fetch(`/api/transcripts/${videoId}`, { method: 'DELETE' })
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Header adopted from the transcript page: logo + rule. */}
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
        </div>
      </header>

      {/* Title sized in em off a 1.6rem base. */}
      <main
        className="flex-1 w-full mx-auto pl-[calc(1.5rem-1%+0.5cm)] pr-6 pt-8 pb-16"
        style={{ maxWidth: '68rem', fontSize: '1.6rem' }}
      >
        <div className="relative inline-block mb-[0.9em]">
          <h1 className="font-display text-[clamp(2.655rem,7.957vw,8.845rem)] leading-[1.0] tracking-tight [text-shadow:0.066em_0.036em_0_rgba(0,0,0,0.15)]">
            Saved Transcripts
          </h1>
          {/* Mint highlighter line, separated from the title with the same gap
              and shadow as the purple line under "Link" on the home page. */}
          <span className="absolute left-0 right-0 -bottom-[0.3847em] h-[0.4557em] bg-mint [box-shadow:0.104em_0.064em_0_rgba(84,255,201,0.3)] pointer-events-none" />
        </div>

        {/* Everything below the title, sized 25% up from the prior 0.64rem. */}
        <div style={{ fontSize: '0.8rem' }}>
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
          // Full black border + dividers box each row into its own rectangle.
          <ul className="divide-y-2 divide-black border-2 border-black">
            {items.map((item) => {
              const c = counts[item.videoId] ?? { highlights: 0, notes: 0 }
              const pct = progress[item.videoId] ?? 0
              return (
                <li key={item.videoId} className="relative group">
                  <Link
                    href={`/transcript/${item.videoId}`}
                    className="block py-[1.1em] pl-[1em] pr-[14em]"
                  >
                    <RowTitle title={item.title || item.videoId} />
                    <p className="font-serif text-[0.9418em] mt-[0.5em] text-black">
                      {item.author && <span>{item.author} · </span>}
                      <span>{displayDate(item)}</span>
                    </p>
                  </Link>

                  {/* Action circles, pinned to the right of the row. */}
                  <div className="absolute right-[1em] top-1/2 -translate-y-1/2 flex items-center gap-[0.6em]">
                    <span className="font-serif font-bold text-purple text-[1.05em] leading-none select-none">{pct}%</span>
                    {c.highlights > 0 && <CountBadge icon={<BrushIcon />} count={c.highlights} tone="mint" href={`/transcript/${item.videoId}#highlights`} />}
                    {c.notes > 0 && <CountBadge icon={<ScrollIcon />} count={c.notes} tone="purple" href={`/transcript/${item.videoId}#notes`} />}
                    <button
                      onClick={() => handleDelete(item.videoId)}
                      aria-label="Delete transcript"
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
        </div>
      </main>
    </div>
  )
}
