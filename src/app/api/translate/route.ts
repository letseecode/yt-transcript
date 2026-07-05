import { NextRequest, NextResponse } from 'next/server'

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const LANGS: Record<string, string> = { fr: 'French', es: 'Spanish' }

// A separator that survives translation intact so we can split paragraphs
// back apart reliably (blank lines alone are riskier).
const SEP = '\n@@@\n'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Translation unavailable.' }, { status: 503 })

  let body: { title?: string; paragraphs?: string[]; target?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const target = body.target ?? ''
  const language = LANGS[target]
  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs : []
  if (!language || paragraphs.length === 0) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const title = body.title ?? ''
  // Title becomes the first chunk so it gets translated too.
  const chunks = [title, ...paragraphs]
  const joined = chunks.join(SEP)

  const prompt = `Translate the following interview transcript into ${language}.
Rules:
- The chunks are separated by the exact delimiter "${SEP.trim()}" on its own line. Keep EXACTLY the same number of chunks separated by that same delimiter, in the same order.
- The first chunk is the TITLE.
- Some paragraphs begin with a speaker label like "Name: ". Keep the person's name unchanged; translate only the spoken words.
- Do not add, drop, merge, or reorder chunks. Do not add commentary. Output only the translation with the delimiters.`

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [{ text: joined }] }],
        generationConfig: { maxOutputTokens: 65536, temperature: 0.2 },
      }),
    })
    if (!res.ok) return NextResponse.json({ error: 'Translation failed.' }, { status: 502 })

    const data = await res.json()
    let full = ''
    for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
      if (typeof part?.text === 'string') full += part.text
    }

    const out = full
      .split(/\n?@@@\n?/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s, i) => s.length > 0 || i === 0)

    if (out.length !== chunks.length) {
      // Count mismatch -- safest to fail rather than misalign highlights.
      return NextResponse.json({ error: 'Translation misaligned.' }, { status: 502 })
    }

    return NextResponse.json({ title: out[0], paragraphs: out.slice(1) })
  } catch {
    return NextResponse.json({ error: 'Translation failed.' }, { status: 502 })
  }
}
