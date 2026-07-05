export interface Highlight {
  id: string
  paragraph: number // index into the transcript's segments
  start: number // char offset within the paragraph's text
  end: number // exclusive
  text: string // the highlighted substring, kept for the notes list
  note: string
  createdAt: number
}

// Highlights are keyed by transcript AND language, because when the text
// is translated the character offsets no longer line up -- each language
// keeps its own set.
const keyFor = (transcriptId: string, lang: string) => `highlights-${transcriptId}-${lang}`

export function loadHighlights(transcriptId: string, lang: string): Highlight[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(keyFor(transcriptId, lang))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHighlights(transcriptId: string, lang: string, highlights: Highlight[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(keyFor(transcriptId, lang), JSON.stringify(highlights))
  } catch {}
}

// Character offset of (node, offset) within `root`'s full text content,
// walking every text node in order. Lets us translate a DOM Selection
// back into a stable [start,end) range over the paragraph's raw string.
export function charOffsetWithin(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let count = 0
  let n: Node | null = walker.nextNode()
  while (n) {
    if (n === node) return count + offset
    count += n.textContent?.length ?? 0
    n = walker.nextNode()
  }
  return count
}
