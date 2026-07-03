export const WAVE_COLORS = ['#000000', '#000000', '#000000', '#4E00FF', '#54FFC9']
export const VIEW_W = 200
export const VIEW_H = 34
export const PX_PER_CM = 37.8

// A smooth, gently rounded sine-like scribble (∿∿∿) rather than a sharp zigzag.
export function makeWavePath(seed: number) {
  const cycles = 1 + (seed % 3) // 1-3 humps -- softer, less frequent oscillation
  const amp = 6 + (seed % 4) // 6-9 amplitude
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
