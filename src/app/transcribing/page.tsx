'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const WAVE_ROWS = 16
const WAVES_PER_ROW = 9
const SETTLE_MS = 28000
const ROW_APPEAR_STEP = 0.5
const PX_PER_CM = 37.8
const MIN_SIZE_CM = 2.5
const MAX_SIZE_CM = 5
const VIEW_W = 200
const VIEW_H = 34

// A smooth, gently rounded sine-like scribble (∿∿∿) rather than a sharp zigzag.
function makeWavePath(seed: number) {
  const cycles = 2 + (seed % 3) // 2-4 humps
  const amp = 8 + (seed % 5) // 8-12 amplitude
  const mid = VIEW_H / 2
  const period = VIEW_W / cycles
  let d = `M0 ${mid}`
  for (let i = 0; i < cycles; i++) {
    const x0 = i * period
    const xMid = x0 + period / 2
    const xEnd = x0 + period
    d += ` C ${x0 + period * 0.25} ${mid - amp}, ${xMid - period * 0.25} ${mid - amp}, ${xMid} ${mid}`
    d += ` C ${xMid + period * 0.25} ${mid + amp}, ${xEnd - period * 0.25} ${mid + amp}, ${xEnd} ${mid}`
  }
  return d
}

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
    }[] = []
    const slotPercent = 100 / WAVES_PER_ROW
    let seed = 0
    for (let row = 0; row < WAVE_ROWS; row++) {
      const rowOffset = (row % 2) * (slotPercent / 2)
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        const jitter = ((seed * 13) % 40) / 100 - 0.2 // +/-0.2 of a slot
        items.push({
          row,
          seed,
          leftPercent: (rowOffset + i * slotPercent + slotPercent / 2 + jitter * slotPercent + 100) % 100,
          slotVw: slotPercent * 0.82,
          sizeCm: MIN_SIZE_CM + ((seed * 0.37) % (MAX_SIZE_CM - MIN_SIZE_CM)),
          appearDelay: row * ROW_APPEAR_STEP + ((seed * 0.11) % 0.4),
          duration: (9 + ((seed * 0.9) % 4.5)) * 1.8,
        })
      }
    }
    return items
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p === 'loading' ? 'settling' : p)), SETTLE_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const url = sessionStorage.getItem('pending-url')
    if (!url) {
      router.replace('/')
      return
    }

    const MIN_VISIBLE_MS = 3000

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden relative">
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
                opacity: fadingOut ? 0 : active ? 1 : 0,
                animation: active
                  ? `wave-appear 1.2s ease-out ${w.appearDelay}s both, wave-rise ${w.duration}s linear ${w.appearDelay}s infinite`
                  : 'none',
                transition: fadingOut ? 'opacity 0.9s ease' : undefined,
              }}
            >
              <path
                d={makeWavePath(w.seed)}
                fill="none"
                stroke="#000000"
                strokeWidth={2.6}
                strokeLinecap="round"
              />
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
