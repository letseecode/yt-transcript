// 100% black
export const WAVE_COLORS = ['#000000']
// A brighter version of each wave color, used for its drop shadow.
export const WAVE_SHADOWS: Record<string, string> = {
  '#000000': '#C5C2BE', // black -> the palette's gray, another 1.1x lighter
  '#54FFC9': '#79eecb', // mint -> 1.2x lighter
  '#4E00FF': '#d88aff', // purple -> 1.3x lighter
}

export const VIEW_W = 200
export const VIEW_H = 34
export const PX_PER_CM = 37.8

// A smooth, gently rounded sine-like scribble (∿∿∿) rather than a sharp zigzag.
export function makeWavePath(seed: number) {
  const cycles = 1 // single hump -- minimal oscillation
  const amp = 1 // near-flat -- oscillates as little as possible
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

// Same centerline as makeWavePath, but returned as a filled, tapered
// ribbon (thin at both ends, thickest at the middle) instead of a
// constant-width stroke -- gives the calligraphy-swoosh texture.
export function makeWaveOutline(seed: number, maxHalfWidth: number) {
  const cycles = 1
  const amp = 4.8 + (seed % 3) // base amplitude increased 1.2x (4 -> 4.8), plus per-wave variance
  const mid = VIEW_H / 2
  const N = 48

  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push({
      x: t * VIEW_W,
      y: mid + amp * Math.sin(2 * Math.PI * cycles * t),
    })
  }

  const top: { x: number; y: number }[] = []
  const bottom: { x: number; y: number }[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const half = maxHalfWidth * Math.sin(Math.PI * t) // 0 at both ends, max at the middle
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(N, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    top.push({ x: pts[i].x + nx * half, y: pts[i].y + ny * half })
    bottom.push({ x: pts[i].x - nx * half, y: pts[i].y - ny * half })
  }

  let d = `M ${top[0].x} ${top[0].y}`
  for (let i = 1; i <= N; i++) d += ` L ${top[i].x} ${top[i].y}`
  for (let i = N; i >= 0; i--) d += ` L ${bottom[i].x} ${bottom[i].y}`
  d += ' Z'
  return d
}
