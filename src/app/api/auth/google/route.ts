import { NextRequest, NextResponse } from 'next/server'
import { authUrl, googleConfigured } from '@/lib/google'

// Kick off the Google OAuth consent flow.
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/feed?error=unconfigured', req.url))
  }
  const origin = new URL(req.url).origin
  const redirectUri = `${origin}/api/auth/google/callback`
  const state = globalThis.crypto.randomUUID()
  const res = NextResponse.redirect(authUrl(redirectUri, state))
  res.cookies.set('yt_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
  return res
}
