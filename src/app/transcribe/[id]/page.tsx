'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const statusMessages: Record<string, string> = {
  queued: 'In the queue — hang tight.',
  processing: 'Transcribing and detecting speakers…',
  completed: 'Done — redirecting.',
  error: 'Something went wrong.',
}

const progressWidth: Record<string, string> = {
  queued: 'w-1/5',
  processing: 'w-2/3',
  completed: 'w-full',
  error: 'w-full',
}

export default function TranscribeProgress() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [status, setStatus] = useState('queued')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/${id}`)
        const data = await res.json()
        setStatus(data.status)

        if (data.status === 'completed') {
          clearInterval(interval)
          router.push(`/transcript/${id}`)
        }

        if (data.status === 'error') {
          clearInterval(interval)
          setErrorMsg(data.error ?? 'Transcription failed. Try a different video.')
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [id, router])

  const isError = status === 'error'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink bg-cream sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="font-headline font-bold text-base uppercase tracking-tight hover:text-red transition-colors">
            YT Transcript
          </Link>
          <span className="text-border select-none">/</span>
          <span className="font-body text-sm text-muted">Processing</span>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full space-y-6">
          <div className="space-y-2">
            <span className="font-headline uppercase tracking-widest text-xs text-muted">
              {status}
            </span>
            <p className={`font-headline text-2xl font-bold ${isError ? 'text-red' : ''}`}>
              {statusMessages[status] ?? 'Working on it…'}
            </p>
            {errorMsg && (
              <p className="font-body text-sm text-muted">{errorMsg}</p>
            )}
          </div>

          <div className="w-full h-3 border-2 border-ink bg-cream overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-out ${progressWidth[status] ?? 'w-0'} ${isError ? 'bg-red' : 'bg-yellow'}`}
            />
          </div>

          {isError && (
            <Link
              href="/"
              className="inline-block font-headline font-bold uppercase tracking-wide text-sm border-2 border-ink px-5 py-3 hover:bg-yellow transition-colors"
            >
              ← Try again
            </Link>
          )}

          {!isError && (
            <p className="font-body text-sm text-muted">
              This can take a few minutes for long videos. Don&apos;t close this tab.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
