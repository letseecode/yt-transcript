'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const WAVE_ROWS = 8
const WAVES_PER_ROW = 3
const SETTLE_MS = 28000

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
  const startedRef = useRef(false)

  const waves = useMemo(() => {
    const items: { row: number; seed: number; left: number; delay: number; duration: number }[] = []
    let seed = 0
    for (let row = 0; row < WAVE_ROWS; row++) {
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        items.push({
          row,
          seed,
          left: 8 + ((seed * 37) % 84),
          delay: (seed * 0.53) % 4,
          duration: 5.5 + ((seed * 0.7) % 3),
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

    const run = async () => {
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
          setPhase('done')
          setTimeout(() => router.push(`/transcript/${data.id}`), 700)
        } else {
          sessionStorage.removeItem('pending-url')
          setErrorMsg(data.error ?? 'Something went wrong. Try again.')
          setPhase('error')
        }
      } catch {
        sessionStorage.removeItem('pending-url')
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
          const active = phase === 'loading' || phase === 'done' || (phase === 'settling' && upperHalf)
          return (
            <svg
              key={w.seed}
              width="34"
              height="13"
              viewBox="0 0 64 24"
              className="absolute"
              style={{
                left: `${w.left}%`,
                bottom: '-40px',
                opacity: active ? 0.75 : 0,
                animation: active
                  ? `wave-rise ${w.duration}s linear ${w.delay}s infinite`
                  : 'none',
                transition: 'opacity 0.6s ease',
              }}
            >
              <path
                d={makeSquigglePath(w.seed)}
                fill="none"
                stroke="#000000"
                strokeWidth={phase === 'done' ? 2.4 : 1.6}
                strokeLinecap="round"
                style={{ transition: 'stroke-width 0.5s ease' }}
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
