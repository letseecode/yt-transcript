export interface Segment {
  text: string
  startMs: number
}

const SYSTEM_PROMPT = `You clean up raw YouTube auto-generated transcripts and turn them into a readable, magazine-style interview transcript.

You will receive a raw transcript. YouTube's captions contain errors: misspelled proper nouns (names of people, places, companies), missing punctuation and capitalization, a duplicated preview snippet at the very start, ">>" markers where a new speaker begins, and "[ __ ]" tokens that censor swear words. The text is also broken into awkward fragments.

Your job:
- Fix obvious transcription errors: correct misspelled names of people, companies, and places using context (e.g. "Kla Harris" -> "Kamala Harris", "Nuome"/"Newsome" -> "Newsom", "Zoron"/"Zaren" -> "Zohran"). Add proper punctuation and capitalization.
- Remove the duplicated preview snippet if the opening text is repeated later.
- Replace each "[ __ ]" with a natural mild word or just remove it so the sentence reads cleanly.
- Thin out filler words ("um", "uh", "you know", "like", "I mean", and accidental stutters such as "I I" or "the the"). Remove roughly half of them — be more aggressive in long passages where they pile up — but do NOT remove all of them: keep enough to preserve the speaker's natural voice and rhythm. Never reword or paraphrase the actual content; only drop fillers and fix stutters.
- IMPORTANT: only remove repetition that is an accidental disfluency (a stumble). PRESERVE repetition that is intentional and carries meaning, including: emphasis ("very, very important", "so, so tired", "really, really"); rhetorical or idiomatic repetition ("blah, blah, blah", "yada yada yada", "no, no, no", "wait, wait, wait", "on and on", "again and again", "more and more"); building a list or rhythm for effect ("I want it now, now, now"); laughter ("ha ha ha"); and someone quoting or imitating speech. When in doubt about whether a repetition is meaningful, keep it.
- Group the text into paragraphs, one per speaker turn. Merge fragments that clearly belong to the same continuous thought.
- When you can confidently identify who is speaking from context, begin that paragraph with their name followed by a colon and a space, e.g. "Nate Silver: I think...". If you cannot tell, just write the paragraph with no name prefix. Never invent names.
- Do NOT summarize, shorten, or omit content. Preserve everything that was said.
- Output ONLY the cleaned transcript. No preamble, no commentary, no markdown formatting (no **, no #). Separate paragraphs with a single blank line.`

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export async function cleanupTranscript(rawText: string): Promise<Segment[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  let full = ''
  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: rawText }] }],
        generationConfig: { maxOutputTokens: 65536, temperature: 0.2 },
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (typeof part?.text === 'string') full += part.text
    }
  } catch {
    return null
  }

  const paragraphs = full
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return null

  return paragraphs.map((text) => ({ text, startMs: 0 }))
}
