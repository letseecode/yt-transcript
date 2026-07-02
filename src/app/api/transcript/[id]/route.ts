import { NextResponse } from 'next/server'
import { getTranscript } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rec = await getTranscript(id)
  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({
    segments: rec.segments,
    title: rec.title,
    author: rec.author,
    url: rec.url,
  })
}
