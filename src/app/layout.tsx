import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Source_Serif_4, Inter, Anton } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline-family',
  weight: ['400', '500', '600', '700'],
})

const anton = Anton({
  subsets: ['latin'],
  variable: '--font-display-family',
  weight: '400',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif-family',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body-family',
})

export const metadata: Metadata = {
  title: 'YourTranscript — Read Instead of Listen',
  description: 'Paste any YouTube video link. Get a full, speaker-labeled transcript in minutes.',
  openGraph: {
    title: 'YourTranscript',
    description: 'Full speaker-labeled transcripts of any YouTube video.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${sourceSerif.variable} ${inter.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  )
}
