'use client'

import { useMemo } from 'react'
import { WAVE_COLORS, VIEW_W, VIEW_H, PX_PER_CM, makeWavePath } from '@/lib/wavePath'

const ROWS = 6
const WAVES_PER_ROW = 6
const MIN_SIZE_CM = 6.5
const MAX_SIZE_CM = 8.45

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
    for (let row = 0; row < ROWS; row++) {
      for (let i = 0; i < WAVES_PER_ROW; i++) {
        seed++
        items.push({
          seed,
          topPercent: (row + 0.5) * (100 / ROWS) + (((seed * 7) % 10) - 5),
          sizeCm: MIN_SIZE_CM + ((seed * 0.53) % (MAX_SIZE_CM - MIN_SIZE_CM)),
          delay: -((seed * 1.7) % 18),
          duration: 14 + ((seed * 1.1) % 10),
          color: WAVE_COLORS[seed % WAVE_COLORS.length],
        })
      }
    }
    return items
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
              animation: exiting
                ? 'wave-sink 0.5s ease-in forwards'
                : `wave-drift ${w.duration}s linear ${w.delay}s infinite`,
            }}
          >
            <path
              d={makeWavePath(w.seed)}
              fill="none"
              stroke={w.color}
              strokeWidth={8.125}
              strokeLinecap="round"
            />
          </svg>
        )
      })}
    </div>
  )
}
