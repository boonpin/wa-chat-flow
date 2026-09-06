import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { v4 as uuidv4 } from 'uuid'
import { readProviderInput, toPublicProvider } from './serialize'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(db.select().from(aiProviders).all().map(toPublicProvider))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input, error } = readProviderInput(await req.json().catch(() => ({})))
  if (error) return NextResponse.json({ error }, { status: 400 })

  if (!input.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!input.kind) return NextResponse.json({ error: 'kind is required' }, { status: 400 })
  if (!input.model) {
    return NextResponse.json(
      { error: 'model is required — pick one from the list this key can reach' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const id = uuidv4()

  db.insert(aiProviders)
    .values({
      id,
      name: input.name,
      kind: input.kind,
      apiKey: input.apiKey ?? null,
      model: input.model,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  const provider = db.select().from(aiProviders).where(eq(aiProviders.id, id)).get()
  return NextResponse.json(provider ? toPublicProvider(provider) : null)
}
