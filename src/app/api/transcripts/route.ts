import { NextResponse } from 'next/server'
import { listTranscripts } from '@/lib/db'

export async function GET() {
  const items = await listTranscripts()
  return NextResponse.json({ items })
}
