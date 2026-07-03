'use client'

import { useMemo } from 'react'
import { WAVE_COLORS, WAVE_SHADOWS, VIEW_W, VIEW_H, PX_PER_CM, makeWaveOutline } from '@/lib/wavePath'

const ROWS = 6
const WAVES_PER_ROW = 6
const MIN_SIZE_CM = 9.36
const MAX_SIZE_CM = 12.17
// Slows the drift by 10%. Set back to 1 to revert this speed change.
const SPEED_FACTOR = 1.1

interface HomeWavesProps {
  // true once the user has hit Transcribe -- waves stop drifting and
  // sink out of view instead, matching how the loading page's waves
  // then rise back up from the bottom on the next screen.
  exiting: boolean
}

export default function HomeWaves({ exiting }: HomeWavesProps) {
  const waves = useMemo(() => {
    const items: {
      seed: number
      topPercent: number
      sizeCm: number
      delay: number
      duration: number
      color: string
    }[] = []
    let seed = 0
    const total = ROWS * WAVES_PER_ROW
    for (let row = 0; row < ROWS; row++) {
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        const duration = (14 + ((seed * 1.1) % 10)) * 1.3 * SPEED_FACTOR
        items.push({
          seed,
          topPercent: 15 + (row + 0.5) * (70 / ROWS) + (((seed * 6) % 6) - 3),
          sizeCm: MIN_SIZE_CM + ((seed * 0.53) % (MAX_SIZE_CM - MIN_SIZE_CM)),
          // Spread starting offsets evenly across the full drift cycle
          // (rather than a modulo pattern that could bunch several
          // waves at similar positions at once) so they don't gather.
          delay: -(((seed - 1) / total) * duration),
          duration,
          color: WAVE_COLORS[(seed * 7) % WAVE_COLORS.length],
        })
      }
    }
    // Thin out the count (drop every 4th, evenly) rather than
    // truncating the tail, so no row loses all its waves.
    return items.filter((_, idx) => (idx + 1) % 4 !== 0)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {waves.map((w) => {
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
              filter: `drop-shadow(${w.color === '#54FFC9' ? '18px 12px' : '9px 6px'} 0 ${WAVE_SHADOWS[w.color]})`,
              animation: exiting
                ? 'wave-sink 0.5s ease-in forwards'
                : `wave-drift ${w.duration}s linear ${w.delay}s infinite`,
            }}
          >
            <path d={makeWaveOutline(w.seed, 2.23)} fill={w.color} stroke="none" />
          </svg>
        )
      })}
    </div>
  )
}
