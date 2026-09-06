import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { aiKeys } from '@/lib/config'
import { getAiProvider } from '@/lib/ai/connection'
import { getProviderModule } from '@/lib/ai/providers'
import { PROVIDER_ENV_KEYS, isProviderKind } from '@/lib/ai/provider-kinds'

/**
 * Asks the vendor which models this key can actually use.
 *
 * POST rather than GET because the key may be one the operator has just typed
 * and not saved yet: a query string would put it in browser history, server
 * logs and the referrer header. Nothing is written here — it is a read of the
 * vendor's catalogue, and a failure is reported as such rather than blocking
 * the form, which can always fall back to a typed model id.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const kind = body.kind
  if (!isProviderKind(kind)) {
    return NextResponse.json({ error: 'kind must be openai or gemini' }, { status: 400 })
  }

  const typed = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const providerId = typeof body.providerId === 'string' ? body.providerId : ''

  // A key typed into the form wins, so the list reflects what is about to be
  // saved rather than what is stored.
  let apiKey = typed
  let source: 'typed' | 'stored' | 'environment' = 'typed'

  if (!apiKey && providerId) {
    const provider = getAiProvider(providerId)
    if (provider?.apiKey) {
      apiKey = provider.apiKey
      source = 'stored'
    }
  }

  if (!apiKey) {
    apiKey = aiKeys[kind]
    source = 'environment'
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: `No API key to list models with. Enter one, or set ${PROVIDER_ENV_KEYS[kind]}.` },
      { status: 400 }
    )
  }

  try {
    const models = await getProviderModule(kind).listModels(apiKey)
    return NextResponse.json({ models, source })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    // 502: the request was fine, the vendor rejected it or was unreachable.
    return NextResponse.json({ error: truncate(detail) }, { status: 502 })
  }
}

/** Vendor errors can carry a page of JSON; the form shows one line. */
function truncate(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim()
  return flat.length > 300 ? `${flat.slice(0, 300)}…` : flat
}
