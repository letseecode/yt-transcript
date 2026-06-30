import { Innertube } from 'youtubei.js'
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

  // Get video info — this gives us direct caption track URLs
  let captionBaseUrl: string | undefined
  try {
    const yt = await Innertube.create()
    const info = await yt.getInfo(videoId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = (info as any).captions?.caption_tracks ?? []
    const track =
      tracks.find((t) => t.language_code?.startsWith('en')) ?? tracks[0]
    captionBaseUrl = track?.base_url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Could not load video info: ${msg}` },
      { status: 422 }
    )
  }

  if (!captionBaseUrl) {
    return NextResponse.json(
      { error: 'No captions available for this video. Try a video with captions enabled.' },
      { status: 422 }
    )
  }

  // Fetch the caption file directly (fmt=json3 returns structured JSON)
  let events: { tStartMs?: number; dDurationMs?: number; segs?: { utf8: string }[] }[]
  try {
    const res = await fetch(`${captionBaseUrl}&fmt=json3`)
    const data = await res.json()
    events = data.events ?? []
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Could not fetch captions: ${msg}` },
      { status: 502 }
    )
  }

  // Group caption lines into readable paragraphs (gap > 2s = new paragraph)
  const segments: Segment[] = []
  let buf = '', bufStart = 0, prevEnd = 0

  for (const ev of events) {
    if (!ev.segs) continue
    const text = ev.segs.map((s) => s.utf8).join('').replace(/\n/g, ' ').trim()
    if (!text || text === '\n') continue

    const startMs = ev.tStartMs ?? 0
    const endMs = startMs + (ev.dDurationMs ?? 3000)

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

  if (segments.length === 0) {
    return NextResponse.json(
      { error: 'No captions available for this video.' },
      { status: 422 }
    )
  }

  return NextResponse.json({ id: randomUUID(), segments })
}
