import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const maxDuration = 30

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

interface SupadataSegment {
  text: string
  offset: number
  duration: number
  lang: string
}

interface Segment { text: string; startMs: number }

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 })
  }

  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let raw: SupadataSegment[]
  try {
    const res = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`,
      { headers: { 'x-api-key': apiKey } }
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = (body as { message?: string }).message ?? `status ${res.status}`
      return NextResponse.json(
        { error: `No transcript available for this video. (${msg})` },
        { status: 422 }
      )
    }
    const data = await res.json()
    raw = data.content ?? []
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Transcript fetch failed: ${msg}` }, { status: 502 })
  }

  if (raw.length === 0) {
    return NextResponse.json(
      { error: 'No transcript available for this video. It may have captions disabled.' },
      { status: 422 }
    )
  }

  // Some transcripts mark each new speaker with ">>". If present, start a
  // fresh block at every ">>". Otherwise fall back to grouping by time gaps.
  const hasSpeakerMarkers = raw.some((item) => item.text.includes('>>'))

  const segments: Segment[] = []

  if (hasSpeakerMarkers) {
    let buf = '', bufStart = 0

    const flush = () => {
      const cleaned = buf.replace(/\s+/g, ' ').trim()
      if (cleaned) segments.push({ text: cleaned, startMs: bufStart })
      buf = ''
    }

    for (const item of raw) {
      const startMs = Math.round(item.offset)
      const text = item.text.replace(/\n/g, ' ')

      // Split on ">>"; first piece continues the current block, the rest each
      // begin a new speaker block.
      const pieces = text.split('>>')

      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i].trim()
        if (i > 0) flush()           // a ">>" ended the previous block
        if (!buf) bufStart = startMs // mark start time for a fresh block
        buf += (buf ? ' ' : '') + piece
      }
    }
    flush()
  } else {
    // No speaker markers: group caption lines into paragraphs (gap > 2s = new)
    let buf = '', bufStart = 0, prevEnd = 0

    for (const item of raw) {
      const startMs = Math.round(item.offset)
      const endMs = startMs + Math.round(item.duration)
      const text = item.text.replace(/\n/g, ' ').trim()
      if (!text) continue

      if (!buf) bufStart = startMs

      if (startMs - prevEnd > 2000 && buf) {
        segments.push({ text: buf.trim(), startMs: bufStart })
        buf = text
        bufStart = startMs
      } else {
        buf += (buf ? ' ' : '') + text
      }
      prevEnd = endMs
    }

    if (buf.trim()) segments.push({ text: buf.trim(), startMs: bufStart })
  }

  return NextResponse.json({ id: randomUUID(), segments })
}
