import { aai } from '@/lib/assemblyai'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  // Step 1: ask Railway to download the audio and stream the actual file back
  const extractRes = await fetch(`${process.env.EXTRACTOR_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!extractRes.ok) {
    return NextResponse.json(
      { error: 'Failed to extract audio from that video.' },
      { status: 500 }
    )
  }

  const audioBuffer = await extractRes.arrayBuffer()

  // Step 2: upload the actual audio bytes to AssemblyAI directly
  const uploadUrl = await aai.files.upload(Buffer.from(audioBuffer))

  // Step 3: submit that permanent AssemblyAI-hosted URL for transcription
  const transcript = await aai.transcripts.submit({
    audio_url: uploadUrl,
    speaker_labels: true,
  })

  return NextResponse.json({ id: transcript.id })
}