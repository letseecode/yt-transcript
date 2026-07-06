// Lightweight Google OAuth + YouTube Data API helper (single-user).
// The app never sees the user's password -- it redirects to Google, gets a
// refresh token back, and stores it in an httpOnly cookie. All calls use raw
// fetch so there's no extra dependency to install.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function authUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YT_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  return res.json() as Promise<{ access_token?: string; refresh_token?: string; expires_in?: number }>
}

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}

async function yt<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`youtube ${res.status}`)
  return res.json() as Promise<T>
}

export interface FeedVideo {
  videoId: string
  title: string
  channel: string
  publishedAt: string
  thumbnail: string
}

// Parse an ISO-8601 duration (e.g. "PT1M5S") into seconds.
function isoSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0))
}

// YouTube has no single "subscription feed" endpoint, so we assemble one:
// subscriptions -> each channel's uploads playlist -> recent uploads within the
// last 30 days -> drop Shorts -> merge and sort by date.
export async function getFeed(token: string): Promise<FeedVideo[]> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000

  // Gather subscriptions (paginate up to ~100 channels).
  const channelTitle: Record<string, string> = {}
  const channelIds: string[] = []
  let pageToken = ''
  for (let page = 0; page < 2; page++) {
    const subs = await yt<{
      nextPageToken?: string
      items?: { snippet: { title: string; resourceId: { channelId: string } } }[]
    }>(`subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical${pageToken ? `&pageToken=${pageToken}` : ''}`, token)
    for (const i of subs.items ?? []) {
      channelIds.push(i.snippet.resourceId.channelId)
      channelTitle[i.snippet.resourceId.channelId] = i.snippet.title
    }
    if (!subs.nextPageToken) break
    pageToken = subs.nextPageToken
  }
  if (channelIds.length === 0) return []

  // Resolve each channel's uploads playlist (channels.list takes up to 50 ids).
  const uploads: { id: string; playlist: string }[] = []
  for (let i = 0; i < channelIds.length; i += 50) {
    const channels = await yt<{ items?: { id: string; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
      `channels?part=contentDetails&id=${channelIds.slice(i, i + 50).join(',')}&maxResults=50`,
      token
    )
    for (const c of channels.items ?? []) uploads.push({ id: c.id, playlist: c.contentDetails.relatedPlaylists.uploads })
  }

  // Recent uploads per channel, keeping only the last 30 days.
  const candidates: FeedVideo[] = []
  await Promise.all(
    uploads.map(async (u) => {
      try {
        const pl = await yt<{
          items?: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string }; thumbnails?: { medium?: { url: string } } } }[]
        }>(`playlistItems?part=snippet&playlistId=${u.playlist}&maxResults=20`, token)
        for (const it of pl.items ?? []) {
          const s = it.snippet
          if (+new Date(s.publishedAt) < cutoff) continue
          candidates.push({
            videoId: s.resourceId.videoId,
            title: s.title,
            channel: channelTitle[u.id] ?? '',
            publishedAt: s.publishedAt,
            thumbnail: s.thumbnails?.medium?.url ?? '',
          })
        }
      } catch {}
    })
  )

  // Fetch durations (videos.list, 50 ids per call) and drop Shorts.
  const durationById: Record<string, number> = {}
  const ids = [...new Set(candidates.map((c) => c.videoId))]
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const vids = await yt<{ items?: { id: string; contentDetails: { duration: string } }[] }>(
        `videos?part=contentDetails&id=${ids.slice(i, i + 50).join(',')}&maxResults=50`,
        token
      )
      for (const v of vids.items ?? []) durationById[v.id] = isoSeconds(v.contentDetails.duration)
    } catch {}
  }

  const isShort = (v: FeedVideo) => {
    const dur = durationById[v.videoId] ?? 0
    return (dur > 0 && dur <= 60) || /#shorts?\b/i.test(v.title)
  }

  return candidates
    .filter((v) => !isShort(v))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
}
