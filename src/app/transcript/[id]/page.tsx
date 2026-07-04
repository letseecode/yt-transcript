'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ReadingSettingsMenu, {
  useReadingPrefs,
  THEMES,
  FONTS,
  SIZE_STEPS,
  SPACING_STEPS,
  WIDTH_STEPS,
} from '@/components/ReadingSettingsMenu'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [prefs, setPrefs] = useReadingPrefs()
  const [headerHidden, setHeaderHidden] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [titleLineRects, setTitleLineRects] = useState<{ left: number; width: number; bottom: number }[]>([])

  // The title's underline needs its own purple-toned shadow, independent
  // of the black shadow on the text -- native text-decoration can't have
  // a separate shadow color, so instead we measure each wrapped line via
  // Range.getClientRects() and draw our own purple bar under each one.
  useLayoutEffect(() => {
    const measure = () => {
      const el = titleRef.current
      if (!el || !el.firstChild) return
      const range = document.createRange()
      range.selectNodeContents(el)
      const parentRect = el.getBoundingClientRect()
      const rects = Array.from(range.getClientRects())
      setTitleLineRects(
        rects.map((r) => ({
          left: r.left - parentRect.left,
          width: r.width,
          bottom: r.bottom - parentRect.top,
        }))
      )
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [title, prefs])

  // Hide the header on scroll-down, bring it back on scroll-up.
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const goingDown = y > lastY
      if (y > 80 && goingDown) {
        setHeaderHidden(true)
      } else if (y < lastY) {
        setHeaderHidden(false)
      }
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  const theme = THEMES[prefs.theme]
  const readingFont = FONTS[prefs.font].family
  const fontSizeScale = SIZE_STEPS[prefs.sizeIdx]
  const lineHeight = SPACING_STEPS[prefs.spacingIdx]
  const readingWidth = WIDTH_STEPS[prefs.widthIdx]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      <header
        className="border-b-2 border-ink bg-surface sticky top-0 z-10 transition-transform duration-200"
        style={{
          position: 'sticky',
          transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)',
        }}
      >
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
          <div className="absolute top-1/2 -translate-y-1/2 right-[19px] flex items-center gap-[9.5px]">
            <button
              onClick={handleDownload}
              className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white transition-colors"
            >
              Download
            </button>
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                aria-label="Reading settings"
                className="font-serif text-[1.214rem] bg-mint text-black border-2 border-ink px-[18px] py-[6px] hover:bg-purple hover:text-white transition-colors"
              >
                Aa
              </button>
              {settingsOpen && (
                <ReadingSettingsMenu prefs={prefs} setPrefs={setPrefs} onClose={() => setSettingsOpen(false)} />
              )}
            </div>
            <Link
              href="/library"
              className="font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white transition-colors"
            >
              Library
            </Link>
          </div>
        </div>
      </header>

      <main
        className="flex-1 w-full mx-auto px-6 py-10 space-y-4"
        style={{ maxWidth: readingWidth, fontFamily: readingFont }}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="relative">
              <h1
                ref={titleRef}
                className="font-serif font-bold text-[4.186rem] leading-tight"
                style={{ textShadow: `0.0858em 0.0517em 0 ${theme.shadow}` }}
              >
                {title}
              </h1>
              {titleLineRects.map((r, i) => (
                <span
                  key={i}
                  className="absolute bg-purple [box-shadow:5.75px_3.46px_0_rgba(78,0,255,0.4)] pointer-events-none"
                  style={{ left: r.left, width: r.width, top: r.bottom - 7, height: '5.54px' }}
                />
              ))}
            </div>
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
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" className="stroke-black transition-colors group-hover:stroke-purple" />
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
            <p key={i} style={{ fontSize: `${fontSizeScale}rem`, lineHeight }}>
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
    </div>
  )
}
