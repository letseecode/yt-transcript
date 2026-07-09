import { NextRequest, NextResponse } from 'next/server'
import { getCaptions, parseVtt } from '@/lib/captions'

// Temporary diagnostic: runs each caption source directly and reports what
// the Vercel runtime actually sees (HTTP status, track counts, first error).
// Visit /api/debug-captions?v=<videoId>. Remove once the chain is stable.

export const maxDuration = 120

const TIMEOUT_MS = 8000
const sig = () => AbortSignal.timeout(TIMEOUT_MS)

type Check = { step: string; ok: boolean; detail: string }

async function checkYouTube(videoId: string): Promise<Check[]> {
  const out: Check[] = []
  const clients: { name: string; body: Record<string, unknown>; ua: string }[] = [
    {
      name: 'IOS',
      body: { context: { client: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en' } } },
      ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    },
    {
      name: 'TV_EMBED',
      body: { context: { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en' }, thirdParty: { embedUrl: 'https://www.youtube.com/' } } },
      ua: 'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    },
    {
      name: 'ANDROID',
      body: { context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } } },
      ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
    },
    {
      name: 'WEB',
      body: { context: { client: { clientName: 'WEB', clientVersion: '2.20250222.10.00', hl: 'en' } } },
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  ]
  for (const c of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': c.ua },
        body: JSON.stringify({ ...c.body, videoId }),
        signal: sig(),
      })
      if (!res.ok) {
        out.push({ step: `youtube:${c.name}`, ok: false, detail: `HTTP ${res.status}` })
        continue
      }
      const data = await res.json()
      const playability = data?.playabilityStatus?.status ?? 'unknown'
      const reason = data?.playabilityStatus?.reason ?? ''
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
      out.push({
        step: `youtube:${c.name}`,
        ok: tracks.length > 0,
        detail: `playability=${playability}${reason ? ` (${reason})` : ''}, captionTracks=${tracks.length}`,
      })
      if (tracks.length > 0) {
        try {
          const capRes = await fetch(`${tracks[0].baseUrl}&fmt=json3`, {
            headers: { 'User-Agent': c.ua },
            signal: sig(),
          })
          const body = capRes.ok ? await capRes.text() : ''
          out.push({
            step: `youtube:${c.name}:track`,
            ok: capRes.ok && body.length > 0,
            detail: `HTTP ${capRes.status}, bytes=${body.length}`,
          })
        } catch (e) {
          out.push({ step: `youtube:${c.name}:track`, ok: false, detail: String(e) })
        }
      }
    } catch (e) {
      out.push({ step: `youtube:${c.name}`, ok: false, detail: String(e) })
    }
  }
  return out
}

async function checkInvidious(videoId: string): Promise<Check[]> {
  const out: Check[] = []
  let instances = ['https://inv.nadeko.net', 'https://yewtu.be', 'https://invidious.nerdvpn.de', 'https://iv.melmac.space']
  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=health', { signal: sig() })
    if (res.ok) {
      const data: [string, { type?: string; api?: boolean; uri?: string }][] = await res.json()
      const live = data
        .filter(([, i]) => i?.type === 'https' && i?.api !== false && i?.uri)
        .map(([, i]) => (i.uri as string).replace(/\/$/, ''))
      out.push({ step: 'invidious:directory', ok: live.length > 0, detail: `${live.length} live instances: ${live.slice(0, 6).join(', ')}` })
      if (live.length > 0) instances = [...new Set([...live, ...instances])]
    } else {
      out.push({ step: 'invidious:directory', ok: false, detail: `HTTP ${res.status}` })
    }
  } catch (e) {
    out.push({ step: 'invidious:directory', ok: false, detail: String(e) })
  }
  for (const base of instances.slice(0, 6)) {
    try {
      const res = await fetch(`${base}/api/v1/captions/${videoId}`, { signal: sig() })
      if (!res.ok) {
        out.push({ step: `invidious:${base}`, ok: false, detail: `HTTP ${res.status}` })
        continue
      }
      const data = (await res.json()) as {
        captions?: { label?: string; language_code?: string; languageCode?: string; url: string }[]
      }
      const tracks = data?.captions ?? []
      out.push({
        step: `invidious:${base}`,
        ok: tracks.length > 0,
        detail: `captions=${tracks.length} [${tracks.map((t) => `${t.language_code ?? t.languageCode}|${t.label}|${t.url}`).join(' ; ').slice(0, 200)}]`,
      })
      // Go all the way: download the caption file exactly like the library
      // does and parse it, reporting each step.
      if (tracks.length > 0) {
        const langOf = (t: (typeof tracks)[number]) => t.language_code ?? t.languageCode ?? ''
        const en = tracks.filter((t) => langOf(t).startsWith('en'))
        const track = en.find((t) => !/auto/i.test(t.label ?? '')) ?? en[0] ?? tracks[0]
        try {
          const capRes = await fetch(`${base}${track.url}`, { signal: sig() })
          const body = capRes.ok ? await capRes.text() : ''
          const parsed = body ? parseVtt(body, 'en') : []
          out.push({
            step: `invidious:${base}:track`,
            ok: parsed.length > 0,
            detail: `HTTP ${capRes.status}, bytes=${body.length}, parsedSegments=${parsed.length}, head="${body.slice(0, 80).replace(/\n/g, '\\n')}"`,
          })
        } catch (e) {
          out.push({ step: `invidious:${base}:track`, ok: false, detail: `download threw: ${String(e).slice(0, 150)}` })
        }
        return out // first live one is enough for diagnosis
      }
    } catch (e) {
      out.push({ step: `invidious:${base}`, ok: false, detail: String(e).slice(0, 120) })
    }
  }
  return out
}

async function checkPiped(videoId: string): Promise<Check[]> {
  const out: Check[] = []
  for (const base of ['https://pipedapi.kavin.rocks', 'https://pipedapi.tokhmi.xyz', 'https://api.piped.private.coffee']) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, { signal: sig() })
      if (!res.ok) {
        out.push({ step: `piped:${base}`, ok: false, detail: `HTTP ${res.status}` })
        continue
      }
      const data = (await res.json()) as {
        subtitles?: { url: string; code?: string; autoGenerated?: boolean }[]
      }
      const subs = data?.subtitles ?? []
      out.push({ step: `piped:${base}`, ok: subs.length > 0, detail: `subtitles=${subs.length}` })
      if (subs.length > 0) {
        const en = subs.filter((s) => (s.code ?? '').startsWith('en'))
        const track = en.find((s) => !s.autoGenerated) ?? en[0] ?? subs[0]
        try {
          const capRes = await fetch(track.url, { signal: sig() })
          const body = capRes.ok ? await capRes.text() : ''
          const parsed = body ? parseVtt(body, 'en') : []
          out.push({
            step: `piped:${base}:track`,
            ok: parsed.length > 0,
            detail: `HTTP ${capRes.status}, bytes=${body.length}, parsedSegments=${parsed.length}, head="${body.slice(0, 80).replace(/\n/g, '\\n')}"`,
          })
        } catch (e) {
          out.push({ step: `piped:${base}:track`, ok: false, detail: `download threw: ${String(e).slice(0, 150)}` })
        }
        return out
      }
    } catch (e) {
      out.push({ step: `piped:${base}`, ok: false, detail: String(e).slice(0, 120) })
    }
  }
  return out
}

async function checkSupadata(videoId: string): Promise<Check[]> {
  const key = process.env.SUPADATA_API_KEY
  if (!key) return [{ step: 'supadata', ok: false, detail: 'no key configured' }]
  try {
    const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`, {
      headers: { 'x-api-key': key },
      signal: sig(),
    })
    const body = await res.text()
    return [{ step: 'supadata', ok: res.ok, detail: `HTTP ${res.status}, ${body.slice(0, 120)}` }]
  } catch (e) {
    return [{ step: 'supadata', ok: false, detail: String(e) }]
  }
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('v') ?? 'dQw4w9WgXcQ'

  // The real question: does the app's own shared library work in this
  // runtime? This is exactly what /api/transcribe calls.
  let lib: Check
  try {
    const result = await getCaptions(videoId)
    lib = result
      ? {
          step: 'lib:getCaptions',
          ok: true,
          detail: `source=${result.source}, segments=${result.segments.length}, first="${result.segments[0]?.text.slice(0, 60)}"`,
        }
      : { step: 'lib:getCaptions', ok: false, detail: 'returned null (all providers failed)' }
  } catch (e) {
    lib = { step: 'lib:getCaptions', ok: false, detail: `threw: ${String(e).slice(0, 200)}` }
  }

  const [youtube, invidious, piped, supadata] = await Promise.all([
    checkYouTube(videoId),
    checkInvidious(videoId),
    checkPiped(videoId),
    checkSupadata(videoId),
  ])
  return NextResponse.json({ videoId, checks: [lib, ...youtube, ...invidious, ...piped, ...supadata] })
}
