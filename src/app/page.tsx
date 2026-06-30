'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Label from '@/components/ui/Label'

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValidYoutubeUrl = (value: string) => {
    return value.includes('youtube.com') || value.includes('youtu.be')
  }

const handleSubmit = async () => {
  setError('')

  if (!url.trim()) {
    setError('Paste a YouTube URL first.')
    return
  }

  if (!isValidYoutubeUrl(url)) {
    setError('That doesn\'t look like a YouTube URL.')
    return
  }

  setLoading(true)

  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()

    if (data.id) {
      router.push(`/transcribe/${data.id}`)
    } else {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  } catch (err) {
    setError('Network error. Try again.')
    setLoading(false)
  }
}

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink px-6 py-4">
        <span className="font-headline font-bold text-lg uppercase">
          YT Transcript
        </span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="space-y-3">
            <Label>Podcasts &amp; Interviews</Label>
            <h1 className="font-headline font-bold text-4xl md:text-5xl leading-tight">
              Paste a YouTube link.
              <br />
              Get a full transcript.
            </h1>
            <p className="text-muted text-base">
              Automatic speaker detection separates the interviewer from the guest.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full border-2 border-ink bg-cream px-4 py-3 outline-none font-body text-base"
            />

            {error && (
              <p className="text-red text-sm font-body">{error}</p>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Transcribe'}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}