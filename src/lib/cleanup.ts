export interface Segment {
  text: string
  startMs: number
}

const SYSTEM_PROMPT = `You clean up raw YouTube auto-generated transcripts and turn them into a readable, magazine-style interview transcript.

You will receive a raw transcript. YouTube's captions contain errors: misspelled proper nouns (names of people, places, companies), missing punctuation and capitalization, a duplicated preview snippet at the very start, ">>" markers where a new speaker begins, and "[ __ ]" tokens that censor swear words. The text is also broken into awkward fragments.

Your job:
- CASE FIX: YouTube sometimes returns the ENTIRE transcript (or long stretches) in ALL-CAPS. If you see this, rewrite it in normal sentence case: lowercase the text and then capitalize ONLY what genuinely should be capitalized — the first letter of each sentence, proper nouns (people, places, companies, brands, products), the pronoun "I", and genuine acronyms (e.g. AI, NATO, GDP, CEO). Never leave text shouting in all-caps.
- Fix obvious transcription errors: correct misspelled names of people, companies, and places using context (e.g. "Kla Harris" -> "Kamala Harris", "Nuome"/"Newsome" -> "Newsom", "Zoron"/"Zaren" -> "Zohran"). Add proper punctuation and capitalization.
- KNOWN MISHEARINGS: YouTube reliably mistranscribes certain words. Whenever you encounter these, replace them (respect the context notes; match case sensibly in context):
    - "Handes" -> "Andes" (e.g. "Universidad de los Andes")
    - "forformational" -> "for informational"
    - "Couch" -> "Kalshi" (in a crypto / prediction-market context)
    - "poly market" -> "Polymarket"
    - "fintex" -> "fintech"
    - "block works" -> "Blockworks" (in a crypto context)
    - "est" -> "esto" (Spanish transcripts)
    - "boños" -> "moños" (Spanish)
    - "fue pucha" -> "juepucha" (Spanish)
    - "Chimath" -> "Chamath"
    - "Palanteer" -> "Palantir"
    - "20inut" -> "twenty-minute"
    - "Daario" -> "Dario" (as in Dario Amodei)
    - "Alex Garp" -> "Alex Karp"
- Remove the duplicated preview snippet if the opening text is repeated later.
- Replace each "[ __ ]" with a natural mild word or just remove it so the sentence reads cleanly.
- Thin out filler words ("um", "uh", "you know", "like", "I mean", and accidental stutters such as "I I" or "the the"). Remove roughly half of them — be more aggressive in long passages where they pile up — but do NOT remove all of them: keep enough to preserve the speaker's natural voice and rhythm. Never reword or paraphrase the actual content; only drop fillers and fix stutters.
- IMPORTANT: only remove repetition that is an accidental disfluency (a stumble). PRESERVE repetition that is intentional and carries meaning, including: emphasis ("very, very important", "so, so tired", "really, really"); rhetorical or idiomatic repetition ("blah, blah, blah", "yada yada yada", "no, no, no", "wait, wait, wait", "on and on", "again and again", "more and more"); building a list or rhythm for effect ("I want it now, now, now"); laughter ("ha ha ha"); and someone quoting or imitating speech. When in doubt about whether a repetition is meaningful, keep it.
- Group the text into paragraphs: start a new paragraph whenever the speaker changes OR a distinct new argument/point begins. Merge fragments that clearly belong to the same continuous thought. These paragraph breaks are the ONLY structure you add — they do the guiding.
- Do NOT prefix paragraphs with speaker names. Leave every paragraph without any name label by default. The ONLY exception: if the text itself states, explicitly and unambiguously, exactly who is speaking and you are ABSOLUTELY certain (100%, no guessing), you may begin that paragraph with their name and a colon. If there is any doubt at all, add no name. Never invent, infer, or guess names, and never use generic labels like "Host", "Interviewer", or "Speaker".
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
