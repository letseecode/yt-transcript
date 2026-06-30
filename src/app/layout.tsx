import type { Metadata } from 'next'
import { Space_Grotesk, Source_Serif_4, Inter } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline-family',
  weight: ['400', '500', '600', '700'],
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
  title: 'YT Transcript — Read Instead of Listen',
  description: 'Paste any YouTube video link. Get a full, speaker-labeled transcript in minutes.',
  openGraph: {
    title: 'YT Transcript',
    description: 'Full speaker-labeled transcripts of any YouTube video.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${sourceSerif.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
