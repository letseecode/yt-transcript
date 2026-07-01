import { NextResponse } from 'next/server'
import { cleanupTranscript } from '@/lib/cleanup'
import { getTranscript, saveTranscript } from '@/lib/db'

export const maxDuration = 300

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

interface Segment {
  text: string
  startMs: number
}

// Look up the video's title/channel from YouTube's public oEmbed endpoint
// (no API key). Falls back to the video id if it's unavailable.
async function fetchTitle(videoId: string): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (res.ok) {
      const d = await res.json()
      return { title: d.title ?? videoId, author: d.author_name ?? '' }
    }
  } catch {}
  return { title: videoId, author: '' }
}

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 })
  }

  // Cache check: if we've already transcribed this video, reuse it and spend
  // zero Supadata credits.
  const cached = await getTranscript(videoId)
  if (cached) {
    return NextResponse.json({
      id: videoId,
      segments: cached.segments,
      title: cached.title,
      cached: true,
    })
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
      const pieces = text.split('>>')
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i].trim()
        if (i > 0) flush()
        if (!buf) bufStart = startMs
        buf += (buf ? ' ' : '') + piece
      }
    }
    flush()
  } else {
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

  // Merge fragments that begin lowercase (continuations, not new speakers).
  const merged: Segment[] = []
  for (const seg of segments) {
    const first = seg.text.trimStart().charAt(0)
    const isContinuation =
      first !== '' && first === first.toLowerCase() && first !== first.toUpperCase()
    if (merged.length > 0 && isContinuation) {
      merged[merged.length - 1].text += ' ' + seg.text
    } else {
      merged.push({ ...seg })
    }
  }

  // AI cleanup pass (falls back to heuristic segments if it fails).
  const rawText = raw.map((item) => item.text).join(' ')
  const cleaned = await cleanupTranscript(rawText)
  const finalSegments = cleaned ?? merged

  // Look up the title, then store in the database for caching + the library.
  const { title, author } = await fetchTitle(videoId)
  await saveTranscript({ videoId, url, title, author, segments: finalSegments })

  return NextResponse.json({ id: videoId, segments: finalSegments, title })
}
