import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/google'

// Google redirects back here with ?code. Exchange it for tokens and stash the
// refresh token in an httpOnly cookie (single-user).
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const saved = req.cookies.get('yt_state')?.value
  if (!code || !state || state !== saved) {
    return NextResponse.redirect(new URL('/feed?error=auth', req.url))
  }
  const redirectUri = `${url.origin}/api/auth/google/callback`
  const tok = await exchangeCode(code, redirectUri)
  const res = NextResponse.redirect(new URL('/feed', req.url))
  res.cookies.delete('yt_state')
  if (tok.refresh_token) {
    res.cookies.set('yt_refresh', tok.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    })
  }
  return res
}
