'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Highlight,
  loadHighlights,
  saveHighlights,
  charOffsetWithin,
} from '@/lib/highlights'

interface Segment {
  text: string
  startMs: number
}

interface Props {
  transcriptId: string
  lang: string // 'en' | 'fr' | 'es' -- drives which dictionary to query
  segments: Segment[]
  fontSizeRem: number
  lineHeight: number
  fontFamily: string
  isDark: boolean
}

const SF_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MINT = '#54FFC9'

type Popup =
  | { kind: 'actions'; x: number; y: number; paragraph: number; start: number; end: number; text: string; isWord: boolean }
  | { kind: 'note'; x: number; y: number; highlightId: string }
  | { kind: 'define'; x: number; y: number; word: string; loading: boolean; result: DefineResult | null }
  | null

interface DefineResult {
  word: string
  phonetic?: string
  meanings: { partOfSpeech: string; definition: string }[]
}

const isSingleWord = (s: string) => /^[\p{L}\p{M}'’-]+$/u.test(s.trim())

export default function TranscriptReader({
  transcriptId,
  lang,
  segments,
  fontSizeRem,
  lineHeight,
  fontFamily,
  isDark,
}: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [popup, setPopup] = useState<Popup>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load / persist highlights per (transcript, language).
  useEffect(() => {
    setHighlights(loadHighlights(transcriptId, lang))
  }, [transcriptId, lang])

  const persist = useCallback(
    (next: Highlight[]) => {
      setHighlights(next)
      saveHighlights(transcriptId, lang, next)
    },
    [transcriptId, lang]
  )

  // --- Selection -> popup ---------------------------------------------------
  const handleMouseUp = useCallback(() => {
    // Let click handlers on existing marks run first.
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const text = sel.toString()
      if (!text.trim()) return

      const startPara = (range.startContainer as HTMLElement).parentElement?.closest?.('[data-p]') as HTMLElement | null
      const endPara = (range.endContainer as HTMLElement).parentElement?.closest?.('[data-p]') as HTMLElement | null
      const paraEl = (range.startContainer.nodeType === Node.TEXT_NODE
        ? (range.startContainer.parentElement?.closest('[data-p]') as HTMLElement | null)
        : ((range.startContainer as HTMLElement).closest?.('[data-p]') as HTMLElement | null)) ?? startPara
      // Only support selections that stay within a single paragraph.
      if (!paraEl || startPara !== endPara) return

      const paragraph = Number(paraEl.dataset.p)
      let start = charOffsetWithin(paraEl, range.startContainer, range.startOffset)
      let end = charOffsetWithin(paraEl, range.endContainer, range.endOffset)
      if (start > end) [start, end] = [end, start]
      if (start === end) return

      const rect = range.getBoundingClientRect()
      setPopup({
        kind: 'actions',
        x: rect.left + rect.width / 2,
        y: rect.top,
        paragraph,
        start,
        end,
        text: text.trim(),
        isWord: isSingleWord(text),
      })
    }, 0)
  }, [])

  // Dismiss the popup on outside click / escape / scroll.
  useEffect(() => {
    if (!popup) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-reader-popup]') || t.closest('[data-hl]')) return
      setPopup(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPopup(null)
    const onScroll = () => setPopup((p) => (p && p.kind === 'actions' ? null : p))
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [popup])

  // --- Actions --------------------------------------------------------------
  const addHighlight = (paragraph: number, start: number, end: number, text: string) => {
    // Merge with any existing highlight in the same paragraph that overlaps.
    const overlapping = highlights.filter(
      (h) => h.paragraph === paragraph && h.start < end && h.end > start
    )
    const mergedStart = Math.min(start, ...overlapping.map((h) => h.start))
    const mergedEnd = Math.max(end, ...overlapping.map((h) => h.end))
    const keptNote = overlapping.map((h) => h.note).filter(Boolean).join('\n')
    const rest = highlights.filter((h) => !overlapping.includes(h))
    const merged: Highlight = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      paragraph,
      start: mergedStart,
      end: mergedEnd,
      text: segments[paragraph].text.slice(mergedStart, mergedEnd),
      note: keptNote,
      createdAt: Date.now(),
    }
    persist([...rest, merged])
    window.getSelection()?.removeAllRanges()
    return merged
  }

  const removeHighlight = (id: string) => {
    persist(highlights.filter((h) => h.id !== id))
    setPopup(null)
  }

  const setNote = (id: string, note: string) => {
    persist(highlights.map((h) => (h.id === id ? { ...h, note } : h)))
  }

  const define = async (word: string, x: number, y: number) => {
    setPopup({ kind: 'define', x, y, word, loading: true, result: null })
    let result: DefineResult | null = null
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.toLowerCase())}`
      )
      if (res.ok) {
        const data = await res.json()
        const entry = Array.isArray(data) ? data[0] : null
        if (entry) {
          const meanings: DefineResult['meanings'] = []
          for (const m of entry.meanings ?? []) {
            const def = m.definitions?.[0]?.definition
            if (def) meanings.push({ partOfSpeech: m.partOfSpeech ?? '', definition: def })
            if (meanings.length >= 3) break
          }
          result = {
            word: entry.word ?? word,
            phonetic: entry.phonetic ?? entry.phonetics?.find((p: { text?: string }) => p.text)?.text,
            meanings,
          }
        }
      }
    } catch {}
    setPopup((p) => (p && p.kind === 'define' && p.word === word ? { ...p, loading: false, result } : p))
  }

  // --- Rendering ------------------------------------------------------------
  const highlightsByPara = useMemo(() => {
    const map = new Map<number, Highlight[]>()
    for (const h of highlights) {
      const arr = map.get(h.paragraph) ?? []
      arr.push(h)
      map.set(h.paragraph, arr)
    }
    return map
  }, [highlights])

  const renderParagraph = (text: string, paraHighlights: Highlight[]) => {
    const nameMatch = text.match(/^([^:]{1,40}):\s+/)
    const nameEnd = nameMatch ? nameMatch[1].length + 1 : 0 // through the colon

    const renderPlain = (a: number, b: number, keyPrefix: string) => {
      // Bold the "Speaker:" prefix where it overlaps this slice.
      if (a < nameEnd) {
        const boldEnd = Math.min(b, nameEnd)
        return (
          <Fragment key={keyPrefix}>
            <span className="font-bold italic">{text.slice(a, boldEnd)}</span>
            {boldEnd < b ? text.slice(boldEnd, b) : null}
          </Fragment>
        )
      }
      return <Fragment key={keyPrefix}>{text.slice(a, b)}</Fragment>
    }

    if (paraHighlights.length === 0) return renderPlain(0, text.length, 'p')

    const points = new Set<number>([0, text.length])
    paraHighlights.forEach((h) => {
      points.add(Math.max(0, h.start))
      points.add(Math.min(text.length, h.end))
    })
    const sorted = [...points].sort((a, b) => a - b)
    const out: React.ReactNode[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (a >= b) continue
      const h = paraHighlights.find((hh) => hh.start <= a && hh.end >= b)
      if (h) {
        out.push(
          <mark
            key={`h-${a}`}
            data-hl={h.id}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setPopup({ kind: 'note', x: r.left + r.width / 2, y: r.top, highlightId: h.id })
            }}
            className="cursor-pointer rounded-[2px] px-[1px]"
            style={{
              background: MINT,
              color: '#1A1A1A',
              boxShadow: h.note ? 'inset 0 -2px 0 #4E00FF' : undefined,
            }}
          >
            {renderPlain(a, b, `h-inner-${a}`)}
          </mark>
        )
      } else {
        out.push(<Fragment key={`t-${a}`}>{renderPlain(a, b, `t-inner-${a}`)}</Fragment>)
      }
    }
    return out
  }

  const orderedHighlights = useMemo(
    () => [...highlights].sort((a, b) => a.paragraph - b.paragraph || a.start - b.start),
    [highlights]
  )

  return (
    <>
      <div ref={containerRef} onMouseUp={handleMouseUp} className="space-y-4 selection:bg-mint selection:text-black">
        {segments.map((seg, i) => (
          <p key={i} data-p={i} style={{ fontSize: `${fontSizeRem}rem`, lineHeight }}>
            {renderParagraph(seg.text, highlightsByPara.get(i) ?? [])}
          </p>
        ))}
      </div>

      {/* Notes / highlights subsection (Kindle-style) */}
      {orderedHighlights.length > 0 && (
        <section className="mt-16 pt-8 border-t-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#1A1A1A' }}>
          <h2 className="font-headline font-bold uppercase text-sm tracking-wide mb-6" style={{ fontFamily }}>
            Notes &amp; Highlights
          </h2>
          <div className="space-y-6">
            {orderedHighlights.map((h) => (
              <div key={h.id} className="flex flex-col gap-2">
                <blockquote
                  className="pl-3 border-l-4 border-purple italic"
                  style={{ fontSize: `${fontSizeRem}rem`, lineHeight }}
                >
                  “{h.text}”
                </blockquote>
                <textarea
                  value={h.note}
                  onChange={(e) => setNote(h.id, e.target.value)}
                  placeholder="Add a note…"
                  rows={h.note ? Math.max(2, h.note.split('\n').length) : 1}
                  className="w-full resize-y bg-transparent outline-none text-[0.95rem] leading-relaxed placeholder:opacity-40 border border-transparent focus:border-purple/40 rounded p-2"
                  style={{ fontFamily: SF_FONT, color: 'inherit' }}
                />
                <button
                  onClick={() => removeHighlight(h.id)}
                  className="self-start text-[0.7rem] uppercase tracking-wide opacity-40 hover:opacity-100 hover:text-purple transition"
                  style={{ fontFamily: SF_FONT }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Floating popups */}
      {popup?.kind === 'actions' && (
        <div
          data-reader-popup
          className="fixed z-50 -translate-x-1/2 -translate-y-full mb-2 flex overflow-hidden rounded-md border-2 border-black bg-white shadow-[3px_3px_0_rgba(0,0,0,0.2)]"
          style={{ left: popup.x, top: popup.y - 8, fontFamily: SF_FONT }}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              addHighlight(popup.paragraph, popup.start, popup.end, popup.text)
              setPopup(null)
            }}
            className="px-3 py-2 text-sm text-black hover:bg-mint transition-colors"
          >
            Highlight
          </button>
          {popup.isWord && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => define(popup.text, popup.x, popup.y)}
              className="px-3 py-2 text-sm text-black border-l-2 border-black hover:bg-mint transition-colors"
            >
              Define
            </button>
          )}
        </div>
      )}

      {popup?.kind === 'note' &&
        (() => {
          const h = highlights.find((x) => x.id === popup.highlightId)
          if (!h) return null
          return (
            <div
              data-reader-popup
              className="fixed z-50 w-[260px] -translate-x-1/2 -translate-y-full rounded-md border-2 border-black bg-white p-3 shadow-[3px_3px_0_rgba(0,0,0,0.2)]"
              style={{ left: popup.x, top: popup.y - 8, fontFamily: SF_FONT }}
            >
              <textarea
                autoFocus
                value={h.note}
                onChange={(e) => setNote(h.id, e.target.value)}
                placeholder="Write a note…"
                rows={3}
                className="w-full resize-y bg-white text-black text-sm outline-none border border-black/20 rounded p-2"
                style={{ fontFamily: SF_FONT }}
              />
              <div className="mt-2 flex justify-between">
                <button
                  onClick={() => removeHighlight(h.id)}
                  className="text-[0.7rem] uppercase tracking-wide text-black/50 hover:text-purple transition"
                >
                  Remove
                </button>
                <button
                  onClick={() => setPopup(null)}
                  className="text-[0.7rem] uppercase tracking-wide font-bold text-black hover:text-purple transition"
                >
                  Done
                </button>
              </div>
            </div>
          )
        })()}

      {popup?.kind === 'define' && (
        <div
          data-reader-popup
          className="fixed z-50 w-[280px] -translate-x-1/2 -translate-y-full rounded-md border-2 border-black bg-white p-4 shadow-[3px_3px_0_rgba(0,0,0,0.2)] text-black"
          style={{ left: popup.x, top: popup.y - 8, fontFamily: SF_FONT }}
        >
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base">{popup.word}</span>
            {popup.result?.phonetic && <span className="text-xs opacity-60">{popup.result.phonetic}</span>}
          </div>
          {popup.loading ? (
            <p className="mt-2 text-sm opacity-60">Looking it up…</p>
          ) : popup.result && popup.result.meanings.length > 0 ? (
            <div className="mt-2 space-y-2">
              {popup.result.meanings.map((m, i) => (
                <p key={i} className="text-sm leading-snug">
                  <span className="italic opacity-60">{m.partOfSpeech}</span> {m.definition}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-60">No definition found.</p>
          )}
        </div>
      )}
    </>
  )
}
