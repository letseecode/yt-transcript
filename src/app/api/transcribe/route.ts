import { aai } from '@/lib/assemblyai'
import { NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'

export const maxDuration = 300

export async function POST(req: Request) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  if (!ytdl.validateURL(url)) {
    return NextResponse.json({ error: 'Invalid YouTube URL.' }, { status: 400 })
  }

  let info
  try {
    info = await ytdl.getInfo(url)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Could not access that video: ${message}` },
      { status: 422 }
    )
  }

  const format = ytdl.chooseFormat(info.formats, {
    quality: 'lowestaudio',
    filter: 'audioonly',
  })

  const audioStream = ytdl.downloadFromInfo(info, { format })

  let uploadUrl: string
  try {
    uploadUrl = await aai.files.upload(audioStream as NodeJS.ReadableStream)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Audio upload failed: ${message}` },
      { status: 502 }
    )
  }

  const transcript = await aai.transcripts.submit({
    audio_url: uploadUrl,
    speaker_labels: true,
  })

  return NextResponse.json({ id: transcript.id })
}
