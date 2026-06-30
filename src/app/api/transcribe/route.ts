import { YoutubeTranscript } from 'youtube-transcript'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

interface Segment {
  text: string
  startMs: number
}

export const maxDuration = 30

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  let raw
  try {
    raw = await YoutubeTranscript.fetchTranscript(url)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `No transcript available for this video. It may have captions disabled. (${msg})` },
      { status: 422 }
    )
  }

  // Group caption lines into paragraphs; gap > 2s = new paragraph
  const segments: Segment[] = []
  let buf = '', bufStart = 0, prevEnd = 0

  for (const item of raw) {
    const start = Math.round(item.offset)
    const end = start + Math.round(item.duration)

    if (!buf) bufStart = start

    if (start - prevEnd > 2000 && buf) {
      segments.push({ text: buf.trim(), startMs: bufStart })
      buf = item.text
      bufStart = start
    } else {
      buf += (buf ? ' ' : '') + item.text
    }

    prevEnd = end
  }

  if (buf.trim()) segments.push({ text: buf.trim(), startMs: bufStart })

  return NextResponse.json({ id: randomUUID(), segments })
}
