import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/session'

// Webhooks are authenticated by HMAC signature, not by the session cookie.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/webhooks/']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    const token = req.cookies.get('auth_token')?.value
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const token = req.cookies.get('auth_token')?.value
  if (!token || !verifyToken(token)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
