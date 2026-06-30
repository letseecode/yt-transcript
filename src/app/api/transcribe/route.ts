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

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 })
  }

  let yt: Innertube
  try {
    yt = await Innertube.create({ retrieve_player: false })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Setup failed: ${msg}` }, { status: 500 })
  }

  let transcriptData
  try {
    const info = await yt.getInfo(videoId)
    transcriptData = await info.getTranscript()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `No transcript available for this video. It may have captions disabled. (${msg})` },
      { status: 422 }
    )
  }

  const rawSegments =
    transcriptData?.transcript?.content?.body?.initial_segments ?? []

  if (rawSegments.length === 0) {
    return NextResponse.json(
      { error: 'No transcript available for this video. It may have captions disabled.' },
      { status: 422 }
    )
  }

  interface Segment { text: string; startMs: number }
  const segments: Segment[] = []
  let buf = '', bufStart = 0, prevEnd = 0

  for (const seg of rawSegments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = seg as any
    const text: string = s?.snippet?.text ?? s?.snippet?.runs?.map((r: {text:string}) => r.text).join('') ?? ''
    const startMs = parseInt(s?.start_ms ?? '0', 10)
    const endMs = parseInt(s?.end_ms ?? String(startMs + 3000), 10)

    if (!text.trim()) continue
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

  return NextResponse.json({ id: randomUUID(), segments })
}
