import Anthropic from '@anthropic-ai/sdk'

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
- Group the text into paragraphs, one per speaker turn. Merge fragments that clearly belong to the same continuous thought.
- When you can confidently identify who is speaking from context, begin that paragraph with their name followed by a colon and a space, e.g. "Nate Silver: I think...". If you cannot tell, just write the paragraph with no name prefix. Never invent names.
- Do NOT summarize, shorten, or omit content. Preserve everything that was said.
- Output ONLY the cleaned transcript. No preamble, no commentary, no markdown formatting (no **, no #). Separate paragraphs with a single blank line.`

export async function cleanupTranscript(rawText: string): Promise<Segment[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const client = new Anthropic({ apiKey })

  let full = ''
  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawText }],
    })
    const message = await stream.finalMessage()
    for (const block of message.content) {
      if (block.type === 'text') full += block.text
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
