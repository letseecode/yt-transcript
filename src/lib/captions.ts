// Caption fetching with a provider chain, so the app never depends on a
// single paid vendor:
//   1. YouTube's own internal player API (Innertube) -- free, no key. This is
//      what youtube.com itself uses. Occasionally blocked from datacenter IPs
//      by YouTube's bot checks, hence the fallbacks.
//   2. TranscriptAPI (transcriptapi.com) -- only tried when
//      TRANSCRIPTAPI_API_KEY is set. Cheap monthly plan, good fallback.
//   3. Supadata -- only tried when SUPADATA_API_KEY is set. Credits are
//      one-time (not monthly), so it goes last to preserve them.
// Callers cache results in the DB, so each video costs at most one fetch ever.

export interface CaptionSegment {
  text: string
  offset: number // ms
  duration: number // ms
  lang: string
}

export interface CaptionResult {
  segments: CaptionSegment[]
  source: 'youtube' | 'transcriptapi' | 'supadata'
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')

// ---------------------------------------------------------------------------
// Provider 1: YouTube Innertube (free)
// ---------------------------------------------------------------------------

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string // 'asr' for auto-generated
}

// The Android client is the most permissive Innertube surface; the web client
// is the fallback shape. Both return the same player response schema.
const INNERTUBE_CLIENTS = [
  {
    context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } },
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
  },
  {
    context: { client: { clientName: 'WEB', clientVersion: '2.20250222.10.00', hl: 'en' } },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  },
]

async function fetchFromYouTube(videoId: string): Promise<CaptionSegment[] | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': client.userAgent },
        body: JSON.stringify({ context: client.context, videoId }),
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
    const res = await fetch(`${track.baseUrl}&fmt=json3`, { headers: { 'User-Agent': userAgent } })
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
    const res = await fetch(track.baseUrl, { headers: { 'User-Agent': userAgent } })
    if (!res.ok) return null
    const xml = await res.text()
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
    return segments.length > 0 ? segments : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Provider 2: TranscriptAPI (optional, TRANSCRIPTAPI_API_KEY)
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
      { headers: { Authorization: `Bearer ${key}` } }
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
// Provider 3: Supadata (optional, SUPADATA_API_KEY; one-time credits, so last)
// ---------------------------------------------------------------------------

async function fetchFromSupadata(videoId: string): Promise<CaptionSegment[] | null> {
  const key = process.env.SUPADATA_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`,
      { headers: { 'x-api-key': key } }
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

export async function getCaptions(videoId: string): Promise<CaptionResult | null> {
  const yt = await fetchFromYouTube(videoId)
  if (yt) return { segments: yt, source: 'youtube' }

  const ta = await fetchFromTranscriptApi(videoId)
  if (ta) return { segments: ta, source: 'transcriptapi' }

  const sd = await fetchFromSupadata(videoId)
  if (sd) return { segments: sd, source: 'supadata' }

  return null
}
