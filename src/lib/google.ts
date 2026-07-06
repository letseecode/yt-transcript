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

// YouTube has no single "subscription feed" endpoint, so we assemble one:
// subscriptions -> each channel's uploads playlist -> newest few uploads ->
// merge and sort by date. Capped to keep API quota small.
export async function getFeed(token: string): Promise<FeedVideo[]> {
  const subs = await yt<{ items?: { snippet: { title: string; resourceId: { channelId: string } } }[] }>(
    'subscriptions?part=snippet&mine=true&maxResults=25&order=alphabetical',
    token
  )
  const channelIds = (subs.items ?? []).map((i) => i.snippet.resourceId.channelId)
  if (channelIds.length === 0) return []
  const channelTitle: Record<string, string> = {}
  for (const i of subs.items ?? []) channelTitle[i.snippet.resourceId.channelId] = i.snippet.title

  const channels = await yt<{ items?: { id: string; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    `channels?part=contentDetails&id=${channelIds.join(',')}&maxResults=50`,
    token
  )
  const uploads = (channels.items ?? []).map((c) => ({ id: c.id, playlist: c.contentDetails.relatedPlaylists.uploads }))

  const videos: FeedVideo[] = []
  await Promise.all(
    uploads.slice(0, 25).map(async (u) => {
      try {
        const pl = await yt<{
          items?: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string }; thumbnails?: { medium?: { url: string } } } }[]
        }>(`playlistItems?part=snippet&playlistId=${u.playlist}&maxResults=3`, token)
        for (const it of pl.items ?? []) {
          const s = it.snippet
          videos.push({
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
  videos.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
  return videos.slice(0, 40)
}
