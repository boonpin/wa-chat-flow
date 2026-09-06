import type { Metadata } from 'next'
import { Source_Sans_3, Geist_Mono } from 'next/font/google'
import './globals.css'

/**
 * Source Sans 3 for everything a person reads: open letterforms that stay
 * legible in a 12px status badge and comfortable in a 16px message bubble.
 * Monospace is reserved for identifiers and raw payloads — never for phone
 * numbers or ordinary business data.
 */
const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'WA Robot',
    template: '%s · WA Robot',
  },
  description: 'Answer WhatsApp customers with AI assistance, and take over whenever you need to.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  )
}
