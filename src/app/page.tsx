'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import HomeWaves from '@/components/HomeWaves'

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const titleEndRef = useRef<HTMLSpanElement>(null)
  const [headerPad, setHeaderPad] = useState<number | null>(null)
  const libraryRef = useRef<HTMLAnchorElement>(null)
  const urlRowRef = useRef<HTMLDivElement>(null)
  const [urlRowWidth, setUrlRowWidth] = useState<number | null>(null)

  useEffect(() => {
    const sync = () => {
      if (titleEndRef.current) {
        const rect = titleEndRef.current.getBoundingClientRect()
        const viewportWidth = document.documentElement.clientWidth
        setHeaderPad(Math.max(0, viewportWidth - rect.right + 16))
      }
    }
    sync()
    document.fonts?.ready?.then(sync)
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  // Stretch the URL input row so its right edge reaches exactly where
  // the Library button ends (only the input grows -- the button beside
  // it keeps its own natural size since it isn't flex-1).
  useEffect(() => {
    const syncRow = () => {
      if (libraryRef.current && urlRowRef.current) {
        const libRect = libraryRef.current.getBoundingClientRect()
        const rowRect = urlRowRef.current.getBoundingClientRect()
        setUrlRowWidth(Math.max(0, libRect.right - rowRect.left))
      }
    }
    syncRow()
    document.fonts?.ready?.then(syncRow)
    window.addEventListener('resize', syncRow)
    return () => window.removeEventListener('resize', syncRow)
  }, [headerPad])

  const isValidYoutubeUrl = (value: string) =>
    value.includes('youtube.com') || value.includes('youtu.be')

  const handleSubmit = () => {
    setError('')

    if (!url.trim()) {
      setError('Put a YouTube URL')
      return
    }

    if (!isValidYoutubeUrl(url)) {
      setError("It doesn't look like a youtube URL")
      return
    }

    setLoading(true)
    try {
      sessionStorage.setItem('pending-url', url)
    } catch {}
    // Give the waves time to sink out of view before we navigate.
    setTimeout(() => router.push('/transcribing'), 450)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative border-b-2 border-ink bg-surface sticky top-0 z-10">
        <div className="w-full pl-[0.8cm] pr-[0.8cm] py-[22px] flex items-center gap-[10px]">
          <a
            href="/"
            className="font-serif text-[1.452rem] text-black underline decoration-purple decoration-2 underline-offset-4 hover:text-purple transition-colors"
          >
            YourTranscript
          </a>
          <span className="flex-1 h-[0.066em] text-[1.452rem] bg-black self-center" />
        </div>
        <span className="absolute top-0 right-[0.8cm] bottom-0 w-[2px] bg-black" />
        <a
          ref={libraryRef}
          href="/library"
          className="absolute top-1/2 -translate-y-1/2 font-headline font-bold uppercase text-[1.214rem] bg-mint text-black border-2 border-ink px-[26px] py-[6px] hover:bg-purple hover:text-white transition-colors"
          style={{ right: headerPad !== null ? `${headerPad}px` : '19px' }}
        >
          Library
        </a>
      </header>

      <section className="border-b-2 border-ink bg-surface text-ink">
        <div className="max-w-5xl ml-0 mr-auto pl-[0.8cm] pr-[19px] pt-[26px] md:pt-[32px] pb-[26px] md:pb-[32px]">
          <p className="font-headline uppercase tracking-wide text-[0.792rem] text-muted mb-[13px] md:mb-[19px]">
            Full Transcripts · Your Own Library&nbsp;&nbsp;//&nbsp;&nbsp;Podcasts · Interviews · Investor Calls
          </p>
          <h1 className="font-display text-[clamp(3.124rem,9.361vw,10.406rem)] leading-[1.0] tracking-tight">
            Paste a{' '}
            <span className="relative inline-block">Link<span className="absolute left-[0.035em] -right-[0.04em] -bottom-[0.02em] h-[0.066em] bg-purple" /></span>
            ;
            <br />
            <span ref={titleEndRef} className="inline-block whitespace-nowrap">
              <span className="text-purple">Read</span> the whole thing.
            </span>
          </h1>
        </div>
      </section>

      <section className="w-full bg-paper border-b-2 border-ink">
        <div className="max-w-5xl ml-0 mr-auto pl-[0.8cm] pr-[0.8cm] pt-[38px] pb-[51px]">
          <div
            ref={urlRowRef}
            className="max-w-[40.3rem] space-y-[10px]"
            style={urlRowWidth !== null ? { width: `${urlRowWidth}px`, maxWidth: 'none' } : undefined}
          >
            <label className="font-headline uppercase text-[0.968rem] text-black block">
              YouTube URL:
            </label>
            <div className="flex border-2 border-purple has-[button:hover]:border-black has-[button:active]:border-black transition-colors">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
                className="url-input flex-1 bg-surface px-[13px] py-[19px] outline-none font-headline text-[1.2rem] text-purple placeholder:text-muted"
              />
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center justify-center bg-ink text-cream font-headline font-bold uppercase text-[1.214rem] border-l-2 border-l-purple px-[19px] hover:bg-purple hover:text-black hover:border-l-black active:bg-purple active:text-black active:border-l-black transition-colors duration-100 disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? 'Processing…' : 'Transcribe →'}
              </button>
            </div>

            {error && (
              <p className="font-headline uppercase text-[0.673rem] text-black">
                {error.split(/(URL)/).map((part, i) =>
                  part === 'URL' ? (
                    <span key={i} className="relative inline-block">
                      URL
                      <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-purple" />
                    </span>
                  ) : (
                    part
                  )
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="relative bg-white overflow-hidden border-b-2 border-ink" style={{ height: '5cm' }}>
        <HomeWaves exiting={loading} />
      </section>
      <section className="flex-1 bg-white" />
    </div>
  )
}
