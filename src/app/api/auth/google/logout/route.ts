import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/feed', req.url))
  res.cookies.delete('yt_refresh')
  return res
}
