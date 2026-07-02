'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const WAVE_ROWS = 16
const WAVES_PER_ROW = 15
const SETTLE_MS = 28000
const ROW_APPEAR_STEP = 0.5

function makeSquigglePath(seed: number) {
  const segments = 5 + (seed % 3)
  const width = 64
  const step = width / segments
  let d = `M0 12`
  for (let i = 1; i <= segments; i++) {
    const x = i * step
    const up = (i + seed) % 2 === 0
    const y = up ? 4 : 20
    const cx = x - step / 2
    d += ` Q${cx} ${up ? 20 : 4} ${x} ${y}`
  }
  return d
}

export default function TranscribingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'settling' | 'done' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [resultTitle, setResultTitle] = useState('')
  const startedRef = useRef(false)

  // row 0 = lowest row (appears first), higher rows appear later as the
  // page fills from the bottom up toward the ceiling.
  const waves = useMemo(() => {
    const items: { row: number; seed: number; left: number; appearDelay: number; duration: number }[] = []
    let seed = 0
    for (let row = 0; row < WAVE_ROWS; row++) {
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        items.push({
          row,
          seed,
          left: 2 + ((seed * 17) % 96),
          appearDelay: row * ROW_APPEAR_STEP + ((seed * 0.11) % 0.4),
          duration: 9 + ((seed * 0.9) % 4.5),
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
          setResultTitle(data.title || 'Transcript ready.')
          setPhase('done')
          setTimeout(() => router.push(`/transcript/${data.id}`), 1400)
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
          const filling = phase === 'loading' || phase === 'settling'
          const active = phase === 'loading' || (phase === 'settling' && upperHalf)
          const fadingOut = phase === 'done' || (phase === 'settling' && !upperHalf)
          return (
            <svg
              key={w.seed}
              width="58"
              height="22"
              viewBox="0 0 64 24"
              className="absolute"
              style={{
                left: `${w.left}%`,
                bottom: '-40px',
                opacity: fadingOut ? 0 : active ? 1 : 0,
                animation: active
                  ? `wave-appear 1.2s ease-out ${w.appearDelay}s both, wave-rise ${w.duration}s linear ${w.appearDelay}s infinite`
                  : filling
                    ? 'none'
                    : 'none',
                transition: fadingOut ? 'opacity 0.9s ease' : undefined,
              }}
            >
              <path
                d={makeSquigglePath(w.seed)}
                fill="none"
                stroke="#000000"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </svg>
          )
        })}
      </div>

      {phase === 'done' && (
        <p className="relative z-10 font-serif text-[1.6rem] text-black bg-white px-6 py-3 text-center max-w-2xl animate-[wave-appear_0.9s_ease-out_both]">
          {resultTitle}
        </p>
      )}

      {phase === 'error' && (
        <p className="relative z-10 font-headline uppercase text-[0.968rem] text-black bg-white px-4 py-2 border-2 border-purple">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
