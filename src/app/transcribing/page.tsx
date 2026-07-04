'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WAVE_SHADOWS, VIEW_W, VIEW_H, PX_PER_CM, makeWaveOutline } from '@/lib/wavePath'

// This page keeps its own color mix (70% black / 10% purple / 20%
// mint) independent from the homepage's palette, since the two are
// tuned separately.
const LOADING_WAVE_COLORS = [
  ...Array(7).fill('#000000'),
  '#4E00FF',
  ...Array(2).fill('#54FFC9'),
]

const WAVE_ROWS = 10
const WAVES_PER_ROW = 8
const SETTLE_MS = 28000
const ROW_APPEAR_STEP = 0.9
// 70% of the homepage's current black-wave range (46.8-85.2cm).
const MIN_SIZE_CM = 32.76
const MAX_SIZE_CM = 59.64
// Same stroke thickness as the homepage's waves.
const HALF_STROKE_WIDTH = 2.23

// How long the bottom-up fill takes to visibly finish, derived from the
// constants above (not a guessed number). We keep the page visible for
// at least this long -- even when the transcript comes back from cache
// almost instantly -- so every visit sees the same unhurried fill, and
// real (uncached) fetches simply ride along with it.
const FILL_COMPLETE_S = (WAVE_ROWS - 1) * ROW_APPEAR_STEP + 0.4
const MIN_VISIBLE_MS = Math.ceil((FILL_COMPLETE_S + 0.6) * 1000)

export default function TranscribingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'settling' | 'done' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const startedRef = useRef(false)

  // row 0 = top, row WAVE_ROWS-1 = bottom. Rows reveal bottom-up (the
  // highest row index appears first). Within every row, half the waves
  // enter from the left and drift rightward, the other half enter from
  // the right and drift leftward -- so they continuously move toward
  // and past one another, like two currents facing off.
  const waves = useMemo(() => {
    const items: {
      row: number
      seed: number
      topPercent: number
      sizeCm: number
      appearDelay: number
      duration: number
      color: string
      fromRight: boolean
    }[] = []
    let seed = 0
    for (let row = 0; row < WAVE_ROWS; row++) {
      const rowAppearDelay = (WAVE_ROWS - 1 - row) * ROW_APPEAR_STEP
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        items.push({
          row,
          seed,
          topPercent: 10 + (row + 0.5) * (80 / WAVE_ROWS) + (((seed * 6) % 6) - 3),
          sizeCm: MIN_SIZE_CM + ((seed * 0.37) % (MAX_SIZE_CM - MIN_SIZE_CM)),
          appearDelay: rowAppearDelay + ((seed * 0.11) % 0.4),
          // 1.5x faster on average than before, with a wider spread so
          // some waves are noticeably quicker and others noticeably slower.
          duration: (9 + ((seed * 0.9) % 9)) * 1.8 * (1 / 1.5),
          color: LOADING_WAVE_COLORS[(seed * 7) % LOADING_WAVE_COLORS.length],
          fromRight: i % 2 === 0,
        })
      }
    }
    return items
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === 'loading' ? 'settling' : p)), SETTLE_MS)
    return () => clearTimeout(t)
  }, [])

  // Guarantee a pure white background behind the waves, regardless of the
  // body's default theme color, for as long as this page is mounted.
  useEffect(() => {
    const prevBg = document.body.style.background
    document.body.style.background = '#FFFFFF'
    return () => {
      document.body.style.background = prevBg
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const url = sessionStorage.getItem('pending-url')
    if (!url) {
      router.replace('/')
      return
    }

    const run = async () => {
      const startedAt = Date.now()
      const waitForMinimum = async () => {
        const elapsed = Date.now() - startedAt
        if (elapsed < MIN_VISIBLE_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS - elapsed))
        }
      }

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
          sessionStorage.removeItem('pending-url')
          await waitForMinimum()
          setPhase('done')
          setTimeout(() => router.push(`/transcript/${data.id}`), 700)
        } else {
          sessionStorage.removeItem('pending-url')
          await waitForMinimum()
          setErrorMsg(data.error ?? 'Something went wrong. Try again.')
          setPhase('error')
        }
      } catch {
        sessionStorage.removeItem('pending-url')
        await waitForMinimum()
        setErrorMsg('Network error. Try again.')
        setPhase('error')
      }
    }

    run()
  }, [router])

  useEffect(() => {
    if (phase === 'error') {
      const t = setTimeout(() => router.replace('/'), 2200)
      return () => clearTimeout(t)
    }
  }, [phase, router])

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        {waves.map((w) => {
          // Top rows (small row index) keep moving longest if the real
          // fetch runs past SETTLE_MS; bottom rows fade out first.
          const upperHalf = w.row < WAVE_ROWS / 2
          const active = phase === 'loading' || (phase === 'settling' && upperHalf)
          const fadingOut = phase === 'done' || (phase === 'settling' && !upperHalf)
          const maxPx = w.sizeCm * PX_PER_CM
          return (
            <svg
              key={w.seed}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="absolute"
              style={{
                top: `${w.topPercent}%`,
                left: 0,
                width: `min(45vw, ${maxPx}px)`,
                aspectRatio: `${VIEW_W} / ${VIEW_H}`,
                filter: `drop-shadow(15px 10px 0 ${WAVE_SHADOWS[w.color]})`,
                opacity: fadingOut ? 0 : active ? 1 : 0,
                animation: active
                  ? `wave-appear-instant 0.05s steps(1,end) ${w.appearDelay}s both, ${w.fromRight ? 'wave-drift-reverse' : 'wave-drift'} ${w.duration}s linear ${w.appearDelay}s infinite`
                  : 'none',
              }}
            >
              <path d={makeWaveOutline(w.seed, HALF_STROKE_WIDTH)} fill={w.color} stroke="none" />
            </svg>
          )
        })}
      </div>

      {phase === 'error' && (
        <p className="relative z-10 font-headline uppercase text-[0.968rem] text-black bg-white px-4 py-2 border-2 border-purple">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
