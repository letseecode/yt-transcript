import { NextRequest, NextResponse } from 'next/server'
import { googleConfigured } from '@/lib/google'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    configured: googleConfigured(),
    connected: !!req.cookies.get('yt_refresh')?.value,
  })
}
