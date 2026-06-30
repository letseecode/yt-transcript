import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline-family',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body-family',
})

export const metadata: Metadata = {
  title: 'YT Transcript',
  description: 'Turn any YouTube interview into a speaker-labeled transcript',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}