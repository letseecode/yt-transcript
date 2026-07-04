'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import HomeWaves from '@/components/HomeWaves'

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    router.push('/transcribing')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative border-b-2 border-ink bg-surface sticky top-0 z-10">
        <div className="w-full pl-[0.8cm] pr-0 py-[22px] flex items-center gap-0">
          <a
            href="/"
            className="relative font-serif text-[1.597rem] text-black hover:text-purple hover:[text-shadow:0.0245em_0.021em_0_rgba(120,120,120,0.54)] transition-[color,text-shadow] duration-150 -translate-y-[3px]"
          >
            YourTranscript
            <span className="absolute left-0 right-0 bottom-[2px] h-[3.3px] bg-purple [box-shadow:2px_1.5px_0_rgba(78,0,255,0.3)] pointer-events-none" />
          </a>
          <span className="w-0 border-l-2 border-ink self-stretch -my-[22px] ml-[0.8cm]" />
          <span className="flex-1 h-0 border-t-2 border-ink self-center" />
        </div>
      </header>

      <section className="relative border-b-2 border-ink bg-surface text-ink">
        <span className="absolute right-[1.26cm] top-0 bottom-0 w-0 border-l-2 border-ink pointer-events-none" />
        <div className="max-w-5xl ml-0 mr-auto pl-[0.8cm] pr-[19px] pt-[26px] md:pt-[32px] pb-[26px] md:pb-[32px]">
          <p className="font-headline uppercase tracking-wide text-[0.792rem] text-muted mb-[13px] md:mb-[19px]">
            Full Transcripts · Your Own Library&nbsp;&nbsp;<span className="text-[0.66rem] align-middle">||</span>&nbsp;&nbsp;Podcasts · Interviews · Investor Calls
          </p>
          <h1 className="font-display text-[clamp(3.124rem,9.361vw,10.406rem)] leading-[1.0] tracking-tight [text-shadow:0.066em_0.036em_0_rgba(0,0,0,0.15)]">
            Paste a{' '}
            <span className="relative inline-block">Link<span className="absolute left-[0.035em] -right-[0.04em] -bottom-[0.02em] h-[0.091em] bg-purple [box-shadow:0.065em_0.04em_0_rgba(78,0,255,0.3)]" /></span>
            ;
            <br />
            <span className="inline-block whitespace-nowrap">
              <span className="text-purple [text-shadow:0.066em_0.036em_0_rgba(78,0,255,0.25)]">Read</span> the whole thing.
            </span>
          </h1>
        </div>
      </section>

      <section className="relative w-full bg-paper border-b-2 border-ink">
        <div className="max-w-5xl ml-0 mr-auto pl-[0.8cm] pr-[0.8cm] pt-[38px] pb-[51px]">
          <div className="max-w-[40.3rem] space-y-[10px]">
            <label className="font-headline uppercase text-[1.102rem] text-black block">
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
                className="flex items-center justify-center bg-ink text-cream font-headline font-bold uppercase text-[1.214rem] border-l-2 border-l-purple px-[19px] hover:bg-purple hover:text-black hover:border-l-black hover:[text-shadow:2px_1.5px_0_rgba(255,255,255,0.23)] active:bg-purple active:text-black active:border-l-black transition-colors duration-100 disabled:opacity-50 whitespace-nowrap"
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
        <div className="absolute left-0 right-0" style={{ top: '0.5cm', bottom: '0.5cm' }}>
          <HomeWaves />
        </div>
      </section>
      <section className="bg-white border-b-2 border-ink" style={{ height: '10cm' }} />
    </div>
  )
}
