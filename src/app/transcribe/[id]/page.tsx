'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Label from '@/components/ui/Label'

const statusMessages: Record<string, string> = {
  queued: 'Waiting in line...',
  processing: 'Transcribing and detecting speakers...',
  completed: 'Done!',
  error: 'Something went wrong.',
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
          setErrorMsg('Transcription failed. Try a different video.')
        }
      } catch (err) {
        // network hiccup, keep trying on next interval
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [id, router])

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink px-6 py-4">
        <span className="font-headline font-bold text-lg uppercase">
          YT Transcript
        </span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Label>{status}</Label>
          <p className="font-headline text-2xl font-bold">
            {statusMessages[status] ?? 'Working on it...'}
          </p>

          {errorMsg && (
            <p className="text-red text-sm">{errorMsg}</p>
          )}

          <div className="w-full h-2 border-2 border-ink bg-cream overflow-hidden">
            <div
              className={`h-full bg-yellow transition-all duration-1000 ${
                status === 'queued' ? 'w-1/4' : status === 'processing' ? 'w-2/3' : 'w-full'
              }`}
            />
          </div>
        </div>
      </section>
    </main>
  )
}