import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { getProvider } from '@/lib/wa/provider'

/**
 * Serves one attachment's bytes to the dashboard.
 *
 * The transport holds the file, not us: `messages.media_url` points into WAHA,
 * which sits on an internal address behind its own API key and is not something
 * a browser can fetch. So the bytes come back through here instead — the same
 * `downloadMedia` the media pass uses, so the seam in `lib/wa/` stays intact
 * and the gateway's address and key never leave the server.
 *
 * Not stored in the database and not embedded in the transcript payload: a
 * conversation with twenty photos in it would otherwise be megabytes of base64
 * on every poll, for images the operator may never scroll back to.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * What may be served inline, by what the bytes actually turned out to be.
 *
 * An allowlist, because the alternative is stored XSS: a customer can send a
 * `.html` document, and echoing it back with its own content type would run
 * their markup on this origin, inside an operator's logged-in session.
 */
const INLINE_PREFIXES = ['image/', 'audio/', 'video/']

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const row = db
    .select({ mediaUrl: messages.mediaUrl, mediaMime: messages.mediaMime })
    .from(messages)
    .where(eq(messages.id, id))
    .get()

  if (!row?.mediaUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let data: Buffer
  let mimeType: string
  try {
    const media = await getProvider().downloadMedia(row.mediaUrl)
    data = media.data
    // The served type wins over the stored one: the stored value is what the
    // sender claimed, and this is what the file turned out to be.
    mimeType = media.mimeType || row.mediaMime || ''
  } catch (err) {
    // Expected in ordinary use — the gateway prunes old media, and a thread
    // scrolled back far enough will find files it no longer holds. The Inbox
    // falls back to the description rather than showing a broken image.
    console.warn(`[wa] Could not serve the attachment on message ${id}:`, err)
    return NextResponse.json({ error: 'The gateway no longer has this file' }, { status: 404 })
  }

  if (!INLINE_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return NextResponse.json({ error: 'That attachment is not viewable' }, { status: 415 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(data.length),
      // Bytes for a given message never change, so the browser should ask once.
      // Private: this is a customer's photo, not something a shared cache may
      // hold on to.
      'Cache-Control': 'private, max-age=86400, immutable',
      'Content-Disposition': 'inline',
      // Belt and braces behind the allowlist above: no sniffing the type back
      // to something executable, and nothing this document loads or runs.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
