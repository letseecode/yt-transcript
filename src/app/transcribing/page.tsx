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
const COL_APPEAR_STEP = 0.12 // staggers left-and-right edges converging toward the center
// Half the size of the homepage's current black-wave range (46.8-85.2cm).
const MIN_SIZE_CM = 23.4
const MAX_SIZE_CM = 42.6

// How long the bottom-up, edges-to-center fill takes to visibly finish,
// derived from the constants above (not a guessed number). We keep the
// page visible for at least this long -- even when the transcript comes
// back from cache almost instantly -- so every visit sees the same
// unhurried fill, and real (uncached) fetches simply ride along with it.
const HALF_ROW = (WAVES_PER_ROW - 1) / 2
const FILL_COMPLETE_S = (WAVE_ROWS - 1) * ROW_APPEAR_STEP + HALF_ROW * COL_APPEAR_STEP + 0.4
const MIN_VISIBLE_MS = Math.ceil((FILL_COMPLETE_S + 0.6) * 1000)

export default function TranscribingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'settling' | 'done' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const startedRef = useRef(false)

  // row 0 = lowest row (appears first), higher rows appear later as the
  // page fills from the bottom up toward the ceiling. Each wave sits in
  // its own horizontal slot so neighbors can pass close by without
  // ever rendering on top of one another.
  const waves = useMemo(() => {
    const items: {
      row: number
      seed: number
      leftPercent: number
      slotVw: number
      sizeCm: number
      appearDelay: number
      duration: number
      color: string
    }[] = []
    const slotPercent = 100 / WAVES_PER_ROW
    let seed = 0
    for (let row = 0; row < WAVE_ROWS; row++) {
      const rowOffset = (row % 2) * (slotPercent / 2)
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        const jitter = ((seed * 13) % 16) / 100 - 0.08 // +/-0.08 of a slot
        items.push({
          row,
          seed,
          leftPercent: (rowOffset + i * slotPercent + slotPercent / 2 + jitter * slotPercent + 100) % 100,
          slotVw: slotPercent * 0.45,
          sizeCm: MIN_SIZE_CM + ((seed * 0.37) % (MAX_SIZE_CM - MIN_SIZE_CM)),
          // Cascades bottom-up (by row); within each row, the left and
          // right edges appear first and the fill advances inward from
          // both sides, meeting in the middle last.
          appearDelay:
            row * ROW_APPEAR_STEP + (HALF_ROW - Math.abs(i - HALF_ROW)) * COL_APPEAR_STEP + ((seed * 0.11) % 0.4),
          // 1.5x faster on average than before, with a wider spread so
          // some waves are noticeably quicker and others noticeably slower.
          duration: (9 + ((seed * 0.9) % 9)) * 1.8 * (1 / 1.5),
          color: LOADING_WAVE_COLORS[(seed * 7) % LOADING_WAVE_COLORS.length],
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
          const upperHalf = w.row >= WAVE_ROWS / 2
          const active = phase === 'loading' || (phase === 'settling' && upperHalf)
          const fadingOut = phase === 'done' || (phase === 'settling' && !upperHalf)
          const maxPx = w.sizeCm * PX_PER_CM
          return (
            <svg
              key={w.seed}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="absolute"
              style={{
                left: `${w.leftPercent}%`,
                bottom: '-40px',
                transform: 'translateX(-50%)',
                width: `clamp(50px, ${w.slotVw}vw, ${maxPx}px)`,
                aspectRatio: `${VIEW_W} / ${VIEW_H}`,
                filter: `drop-shadow(15px 10px 0 ${WAVE_SHADOWS[w.color]})`,
                opacity: fadingOut ? 0 : active ? 1 : 0,
                animation: active
                  ? `wave-appear-instant 0.05s steps(1,end) ${w.appearDelay}s both, wave-rise ${w.duration}s linear ${w.appearDelay}s infinite`
                  : 'none',
              }}
            >
              <path d={makeWaveOutline(w.seed, 5.85)} fill={w.color} stroke="none" />
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
