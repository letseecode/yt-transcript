import { NextResponse } from 'next/server'
import { deleteTranscript } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  await deleteTranscript(id)
  return NextResponse.json({ ok: true })
}
