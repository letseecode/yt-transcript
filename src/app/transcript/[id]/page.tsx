'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SpeakerBlock from '@/components/SpeakerBlock'
import Button from '@/components/ui/Button'

interface Utterance {
  speaker: string
  text: string
  start: number
  end: number
}

export default function TranscriptPage() {
  const params = useParams()
  const id = params.id as string

  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTranscript = async () => {
      const res = await fetch(`/api/transcribe/${id}`)
      const data = await res.json()
      setUtterances(data.utterances ?? [])

      const uniqueSpeakers: string[] = Array.from(
        new Set(data.utterances.map((u: Utterance) => u.speaker))
      )

      const savedNames = localStorage.getItem(`names-${id}`)
      const parsedSaved = savedNames ? JSON.parse(savedNames) : {}

      const defaultNames: Record<string, string> = {}
      uniqueSpeakers.forEach((s) => {
        defaultNames[s] = parsedSaved[s] ?? `Speaker ${s}`
      })

      setNames(defaultNames)
      setLoading(false)
    }

    fetchTranscript()
  }, [id])

  const handleRename = (speakerKey: string, newName: string) => {
    setNames((prev) => {
      const updated = { ...prev, [speakerKey]: newName }
      localStorage.setItem(`names-${id}`, JSON.stringify(updated))
      return updated
    })
  }

  const buildExportText = () => {
    return utterances
      .map((u) => {
        const name = names[u.speaker] ?? `Speaker ${u.speaker}`
        return `[${name}]\n${u.text}`
      })
      .join('\n\n')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(buildExportText())
  }

  const handleDownload = () => {
    const text = buildExportText()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcript.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-headline text-xl">Loading transcript...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b-2 border-ink px-6 py-4 flex items-center justify-between">
        <span className="font-headline font-bold text-lg uppercase">
          YT Transcript
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopy}>Copy</Button>
          <Button variant="outline" onClick={handleDownload}>Download</Button>
        </div>
      </header>

      <section className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-6">
        {utterances.map((u, index) => (
          <SpeakerBlock
            key={index}
            speakerKey={u.speaker}
            displayName={names[u.speaker] ?? `Speaker ${u.speaker}`}
            text={u.text}
            startMs={u.start}
            onRename={(newName) => handleRename(u.speaker, newName)}
          />
        ))}
      </section>
    </main>
  )
}