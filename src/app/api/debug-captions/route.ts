import { NextRequest, NextResponse } from 'next/server'

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
      const data = (await res.json()) as { captions?: { url: string }[] }
      const n = data?.captions?.length ?? 0
      out.push({ step: `invidious:${base}`, ok: n > 0, detail: `captions=${n}` })
      if (n > 0) return out // first live one is enough for diagnosis
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
      const data = (await res.json()) as { subtitles?: unknown[] }
      const n = data?.subtitles?.length ?? 0
      out.push({ step: `piped:${base}`, ok: n > 0, detail: `subtitles=${n}` })
      if (n > 0) return out
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
  const [youtube, invidious, piped, supadata] = await Promise.all([
    checkYouTube(videoId),
    checkInvidious(videoId),
    checkPiped(videoId),
    checkSupadata(videoId),
  ])
  return NextResponse.json({ videoId, checks: [...youtube, ...invidious, ...piped, ...supadata] })
}
