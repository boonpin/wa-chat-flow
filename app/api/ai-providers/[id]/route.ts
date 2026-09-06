import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiBots, aiProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { readProviderInput, toPublicProvider } from '../serialize'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = db.select().from(aiProviders).where(eq(aiProviders.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { input, error } = readProviderInput(await req.json().catch(() => ({})))
  if (error) return NextResponse.json({ error }, { status: 400 })

  if (input.name !== undefined && !input.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (input.model !== undefined && !input.model) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 })
  }

  db.update(aiProviders)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(aiProviders.id, id))
    .run()

  const provider = db.select().from(aiProviders).where(eq(aiProviders.id, id)).get()
  return NextResponse.json(provider ? toPublicProvider(provider) : null)
}

/**
 * Refused while a bot still points here.
 *
 * Deleting anyway would leave those bots with no vendor, no key and no model —
 * a failure that only shows up the next time a customer messages. Naming the
 * bots is what makes it fixable.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const inUse = db
    .select({ name: aiBots.name })
    .from(aiBots)
    .where(eq(aiBots.providerId, id))
    .all()

  if (inUse.length > 0) {
    const names = inUse.map((b) => `“${b.name}”`).join(', ')
    return NextResponse.json(
      {
        error:
          `This provider is still used by ${names}. ` +
          'Point those bots at another provider first.',
      },
      { status: 409 }
    )
  }

  db.delete(aiProviders).where(eq(aiProviders.id, id)).run()

  // Usage rows are deliberately kept: what an account already spent stays true
  // after it is removed, and every row carries its own vendor and model.
  return NextResponse.json({ ok: true })
}
