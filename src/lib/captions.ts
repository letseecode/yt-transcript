// Caption fetching with a provider chain, so the app never depends on a
// single paid vendor. Free layers run first; paid keys are a last resort.
//
//   1. YouTube's own internal player API (Innertube), tried across several
//      client disguises (Android/iOS/TV-embed/web) -- each hits different
//      anti-bot rules, so one often works where another is blocked.
//   2. The Invidious network -- free public YouTube mirrors with a caption
//      API. The live instance directory is fetched at runtime so dead
//      instances rotate out on their own.
//   3. The Piped network -- an independent second mirror network.
//   4. TranscriptAPI (TRANSCRIPTAPI_API_KEY) -- paid, residential proxies.
//   5. Supadata (SUPADATA_API_KEY) -- one-time credits, so it goes last.
//
// Callers cache results in the DB, so each video costs at most one fetch ever.

export interface CaptionSegment {
  text: string
  offset: number // ms
  duration: number // ms
  lang: string
}

export interface CaptionResult {
  segments: CaptionSegment[]
  source: 'youtube' | 'invidious' | 'piped' | 'transcriptapi' | 'supadata'
}

const REQUEST_TIMEOUT_MS = 8000
const timeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS)

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')

// ---------------------------------------------------------------------------
// Provider 1: YouTube Innertube (free, direct)
// ---------------------------------------------------------------------------

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string // 'asr' for auto-generated
}

// Each Innertube client is scored separately by YouTube's anti-bot systems,
// so we walk through several. iOS and the embedded-TV player are the usual
// survivors on datacenter IPs.
const INNERTUBE_CLIENTS: { body: Record<string, unknown>; userAgent: string }[] = [
  {
    body: {
      context: { client: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en' } },
    },
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  },
  {
    body: {
      context: {
        client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en' },
        thirdParty: { embedUrl: 'https://www.youtube.com/' },
      },
    },
    userAgent: 'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  },
  {
    body: {
      context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } },
    },
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
  },
  {
    body: {
      context: { client: { clientName: 'WEB', clientVersion: '2.20250222.10.00', hl: 'en' } },
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  },
]

async function fetchFromYouTube(videoId: string): Promise<CaptionSegment[] | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': client.userAgent },
        body: JSON.stringify({ ...client.body, videoId }),
        signal: timeout(),
      })
      if (!res.ok) continue
      const data = await res.json()
      const tracks: CaptionTrack[] =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
      if (tracks.length === 0) continue

      // Prefer a human-made English track, then auto-generated English, then
      // whatever exists.
      const en = tracks.filter((t) => t.languageCode?.startsWith('en'))
      const track = en.find((t) => t.kind !== 'asr') ?? en[0] ?? tracks[0]

      const segments = await fetchTrack(track, client.userAgent)
      if (segments && segments.length > 0) return segments
    } catch {}
  }
  return null
}

async function fetchTrack(track: CaptionTrack, userAgent: string): Promise<CaptionSegment[] | null> {
  const lang = track.languageCode ?? 'en'

  // json3 gives clean structured events; fall back to the raw XML shape.
  try {
    const res = await fetch(`${track.baseUrl}&fmt=json3`, {
      headers: { 'User-Agent': userAgent },
      signal: timeout(),
    })
    if (res.ok) {
      const data = await res.json()
      const events: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] =
        data?.events ?? []
      const segments: CaptionSegment[] = []
      for (const e of events) {
        const text = (e.segs ?? []).map((s) => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim()
        if (!text) continue
        segments.push({ text, offset: e.tStartMs ?? 0, duration: e.dDurationMs ?? 0, lang })
      }
      if (segments.length > 0) return segments
    }
  } catch {}

  try {
    const res = await fetch(track.baseUrl, {
      headers: { 'User-Agent': userAgent },
      signal: timeout(),
    })
    if (!res.ok) return null
    const xml = await res.text()
    const segments = parseTimedTextXml(xml, lang)
    return segments.length > 0 ? segments : null
  } catch {
    return null
  }
}

function parseTimedTextXml(xml: string, lang: string): CaptionSegment[] {
  const segments: CaptionSegment[] = []
  const re = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const text = decodeEntities(m[3]).replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim()
    if (!text) continue
    segments.push({
      text,
      offset: Math.round(parseFloat(m[1]) * 1000),
      duration: Math.round(parseFloat(m[2] ?? '0') * 1000),
      lang,
    })
  }
  return segments
}

// ---------------------------------------------------------------------------
// WebVTT parsing (Invidious/Piped serve captions as VTT)
// ---------------------------------------------------------------------------

function vttTimeToMs(t: string): number {
  const parts = t.trim().split(':')
  const sec = parseFloat(parts.pop() ?? '0')
  const min = parseInt(parts.pop() ?? '0', 10)
  const hr = parseInt(parts.pop() ?? '0', 10)
  return Math.round(((hr * 60 + min) * 60 + sec) * 1000)
}

export function parseVtt(vtt: string, lang: string): CaptionSegment[] {
  const segments: CaptionSegment[] = []
  const lines = vtt.split(/\r?\n/)
  let i = 0
  let lastText = ''
  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(/([\d:.]+)\s+-->\s+([\d:.]+)/)
    if (!m) {
      i++
      continue
    }
    const start = vttTimeToMs(m[1])
    const end = vttTimeToMs(m[2])
    i++
    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i])
      i++
    }
    const text = decodeEntities(textLines.join(' '))
      .replace(/<[^>]+>/g, '') // strip <c>/<i> styling tags
      .replace(/\s+/g, ' ')
      .trim()
    // Auto-caption VTT repeats each line in rolling pairs -- skip repeats.
    if (text && text !== lastText) {
      segments.push({ text, offset: start, duration: end - start, lang })
      lastText = text
    }
  }
  return segments
}

// TTML/DFXP (what Piped serves): <p begin="00:00:01.234" end="...">text</p>.
// Times are either clock format or bare seconds like "12.34s".
function ttmlTimeToMs(t: string): number {
  if (t.endsWith('s') && !t.includes(':')) return Math.round(parseFloat(t) * 1000)
  return vttTimeToMs(t)
}

function parseTtml(xml: string, lang: string): CaptionSegment[] {
  const segments: CaptionSegment[] = []
  const re = /<p([^>]*)>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]
    const begin = attrs.match(/begin="([^"]+)"/)?.[1]
    if (!begin) continue
    const end = attrs.match(/end="([^"]+)"/)?.[1]
    const text = decodeEntities(m[2].replace(/<br\s*\/?>/gi, ' '))
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    const start = ttmlTimeToMs(begin)
    const endMs = end ? ttmlTimeToMs(end) : start
    segments.push({ text, offset: start, duration: Math.max(0, endMs - start), lang })
  }
  return segments
}

// Mirrors serve captions in whichever format their backend produced --
// sniff the body instead of trusting any single one.
export function parseCaptionBody(body: string, lang: string): CaptionSegment[] {
  const head = body.trimStart().slice(0, 200)
  if (head.startsWith('WEBVTT')) return parseVtt(body, lang)
  if (head.includes('<tt')) return parseTtml(body, lang)
  if (head.includes('<transcript') || head.includes('<text')) return parseTimedTextXml(body, lang)
  return parseVtt(body, lang)
}

// ---------------------------------------------------------------------------
// Provider 2: Invidious network (free public mirrors)
// ---------------------------------------------------------------------------

// Seeds are only a fallback; the live directory at api.invidious.io is
// preferred so dead instances rotate out without a code change.
const INVIDIOUS_SEEDS = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://iv.melmac.space',
]
const MAX_INSTANCES = 6

async function invidiousInstances(): Promise<string[]> {
  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=health', {
      signal: timeout(),
    })
    if (res.ok) {
      const data: [string, { type?: string; api?: boolean; uri?: string }][] = await res.json()
      const live = data
        .filter(([, info]) => info?.type === 'https' && info?.api !== false && info?.uri)
        .map(([, info]) => (info.uri as string).replace(/\/$/, ''))
      if (live.length > 0) {
        // Directory order first, then any seeds it missed.
        return [...new Set([...live, ...INVIDIOUS_SEEDS])].slice(0, MAX_INSTANCES)
      }
    }
  } catch {}
  return INVIDIOUS_SEEDS
}

async function fetchFromInvidious(videoId: string): Promise<CaptionSegment[] | null> {
  const instances = await invidiousInstances()
  for (const base of instances) {
    try {
      const res = await fetch(`${base}/api/v1/captions/${videoId}`, { signal: timeout() })
      if (!res.ok) continue
      const data = (await res.json()) as {
        captions?: { label?: string; language_code?: string; languageCode?: string; url: string }[]
      }
      const tracks = data?.captions ?? []
      if (tracks.length === 0) continue
      const langOf = (t: (typeof tracks)[number]) => t.language_code ?? t.languageCode ?? ''
      const en = tracks.filter((t) => langOf(t).startsWith('en'))
      // Auto-generated tracks are labeled "(auto-generated)"; prefer human ones.
      const track =
        en.find((t) => !/auto/i.test(t.label ?? '')) ?? en[0] ?? tracks[0]

      const capRes = await fetch(`${base}${track.url}`, { signal: timeout() })
      if (!capRes.ok) continue
      const segments = parseCaptionBody(await capRes.text(), langOf(track) || 'en')
      if (segments.length > 0) return segments
    } catch {}
  }
  return null
}

// ---------------------------------------------------------------------------
// Provider 3: Piped network (free public mirrors, independent of Invidious)
// ---------------------------------------------------------------------------

const PIPED_APIS = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.private.coffee',
]

async function fetchFromPiped(videoId: string): Promise<CaptionSegment[] | null> {
  for (const base of PIPED_APIS) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, { signal: timeout() })
      if (!res.ok) continue
      const data = (await res.json()) as {
        subtitles?: { url: string; code?: string; autoGenerated?: boolean }[]
      }
      const subs = data?.subtitles ?? []
      if (subs.length === 0) continue
      const en = subs.filter((s) => (s.code ?? '').startsWith('en'))
      const track = en.find((s) => !s.autoGenerated) ?? en[0] ?? subs[0]

      const capRes = await fetch(track.url, { signal: timeout() })
      if (!capRes.ok) continue
      const segments = parseCaptionBody(await capRes.text(), track.code ?? 'en')
      if (segments.length > 0) return segments
    } catch {}
  }
  return null
}

// ---------------------------------------------------------------------------
// Provider 4: TranscriptAPI (paid, TRANSCRIPTAPI_API_KEY)
// ---------------------------------------------------------------------------

async function fetchFromTranscriptApi(videoId: string): Promise<CaptionSegment[] | null> {
  const key = process.env.TRANSCRIPTAPI_API_KEY
  if (!key) return null
  try {
    // v2 shape: GET ?video_url=..., Bearer auth, response is
    // { title, duration, segments: [{ start (seconds), text }] }.
    // Segments carry no per-line duration, so we leave it 0 (the caller's
    // grouping only needs the start offset).
    const res = await fetch(
      `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=json&include_timestamp=true&send_metadata=false`,
      { headers: { Authorization: `Bearer ${key}` }, signal: timeout() }
    )
    if (!res.ok) return null
    const data = await res.json()
    const items: { text: string; start?: number }[] = data?.segments ?? []
    const segments = items
      .map((i) => ({
        text: (i.text ?? '').replace(/\n/g, ' ').trim(),
        offset: Math.round((i.start ?? 0) * 1000),
        duration: 0,
        lang: 'en',
      }))
      .filter((s) => s.text)
    return segments.length > 0 ? segments : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Provider 5: Supadata (paid one-time credits, SUPADATA_API_KEY; last)
// ---------------------------------------------------------------------------

async function fetchFromSupadata(videoId: string): Promise<CaptionSegment[] | null> {
  const key = process.env.SUPADATA_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`,
      { headers: { 'x-api-key': key }, signal: timeout() }
    )
    if (!res.ok) return null
    const data = await res.json()
    const items: { text: string; offset: number; duration: number; lang?: string }[] =
      data?.content ?? []
    const segments = items
      .map((i) => ({
        text: (i.text ?? '').replace(/\n/g, ' ').trim(),
        offset: Math.round(i.offset ?? 0),
        duration: Math.round(i.duration ?? 0),
        lang: i.lang ?? 'en',
      }))
      .filter((s) => s.text)
    return segments.length > 0 ? segments : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------

const PROVIDERS: { source: CaptionResult['source']; fn: (id: string) => Promise<CaptionSegment[] | null> }[] = [
  { source: 'youtube', fn: fetchFromYouTube },
  { source: 'invidious', fn: fetchFromInvidious },
  { source: 'piped', fn: fetchFromPiped },
  { source: 'transcriptapi', fn: fetchFromTranscriptApi },
  { source: 'supadata', fn: fetchFromSupadata },
]

export async function getCaptions(videoId: string): Promise<CaptionResult | null> {
  for (const { source, fn } of PROVIDERS) {
    const segments = await fn(videoId)
    if (segments && segments.length > 0) {
      console.log(`captions: ${videoId} served by ${source}`)
      return { segments, source }
    }
  }
  return null
}
