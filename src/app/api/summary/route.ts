import { NextRequest, NextResponse } from 'next/server'
import { getTranscript } from '@/lib/db'

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

// Pull captions -- reuse an already-saved transcript if we have one, else
// fetch fresh from Supadata.
async function captionsText(videoId: string): Promise<string> {
  const saved = await getTranscript(videoId)
  if (saved?.segments?.length) return saved.segments.map((s) => s.text).join('\n')
  const key = process.env.SUPADATA_API_KEY
  if (!key) return ''
  try {
    const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`, {
      headers: { 'x-api-key': key },
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.content ?? []).map((c: { text: string }) => c.text).join(' ')
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  let body: { videoId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const videoId = (body.videoId ?? '').trim()
  if (!videoId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const text = (await captionsText(videoId)).slice(0, 24000)
  if (!text) return NextResponse.json({ error: 'no captions', summary: '' }, { status: 200 })

  const prompt = `You are summarizing a video from its transcript. Respond in this exact shape:
First line: a one-sentence TL;DR (no label, just the sentence).
Then a blank line.
Then 5-8 bullet points capturing the main points, each starting with "- ".
No headings, no extra commentary.

Transcript:
${text}`

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
      }),
    })
    if (!res.ok) return NextResponse.json({ error: 'failed' }, { status: 502 })
    const data = await res.json()
    let full = ''
    for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
      if (typeof part?.text === 'string') full += part.text
    }
    return NextResponse.json({ summary: full.trim() })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 502 })
  }
}
