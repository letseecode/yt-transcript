import { NextRequest, NextResponse } from 'next/server'

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const LANGS: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish' }

// Dictionary fallback: the free dictionaryapi.dev is unreliable for
// French/Spanish, so we ask Gemini for a concise definition in the
// target language. Returns the same shape the client already expects.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  let body: { word?: string; lang?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const word = (body.word ?? '').trim()
  const language = LANGS[body.lang ?? ''] ?? 'English'
  if (!word) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const prompt = `You are a dictionary. Define the ${language} word "${word}".
Respond with ONE line in exactly this format:
<part of speech> ||| <a concise definition written in ${language}>
Use ${language} for the part of speech too. No extra text. If it is not a real word, respond: — ||| No definition found.`

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.2 },
      }),
    })
    if (!res.ok) return NextResponse.json({ error: 'failed' }, { status: 502 })
    const data = await res.json()
    let full = ''
    for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
      if (typeof part?.text === 'string') full += part.text
    }
    const line = full.trim().split('\n')[0] ?? ''
    const [pos, def] = line.split('|||').map((s) => s.trim())
    if (!def) return NextResponse.json({ meanings: [] })
    return NextResponse.json({ word, meanings: [{ partOfSpeech: pos ?? '', definition: def }] })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 502 })
  }
}
