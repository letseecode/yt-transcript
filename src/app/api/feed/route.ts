import { NextRequest, NextResponse } from 'next/server'
import { getFeed, refreshAccessToken } from '@/lib/google'

export async function GET(req: NextRequest) {
  const refresh = req.cookies.get('yt_refresh')?.value
  if (!refresh) return NextResponse.json({ error: 'not connected' }, { status: 401 })
  try {
    const access = await refreshAccessToken(refresh)
    if (!access) return NextResponse.json({ error: 'refresh failed' }, { status: 401 })
    const items = await getFeed(access)
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: 'feed failed' }, { status: 502 })
  }
}
