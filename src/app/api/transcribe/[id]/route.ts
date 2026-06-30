import { aai } from '@/lib/assemblyai'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const transcript = await aai.transcripts.get(id)

  return NextResponse.json({
    status: transcript.status,
    utterances: transcript.utterances ?? [],
    error: transcript.error ?? null,
  })
}