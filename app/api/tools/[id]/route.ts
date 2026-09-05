import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { botTools, toolInvocations, tools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { readToolInput, toPublicTool } from '../serialize'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = db.select().from(tools).where(eq(tools.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { input, error } = readToolInput(await req.json().catch(() => ({})))
  if (error) return NextResponse.json({ error }, { status: 400 })

  try {
    db.update(tools)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(tools.id, id))
      .run()
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: `A tool named "${input.name}" already exists` }, { status: 409 })
    }
    throw err
  }

  const tool = db.select().from(tools).where(eq(tools.id, id)).get()
  return NextResponse.json(tool ? toPublicTool(tool) : null)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Past captures are kept: they are the record of what a customer actually
  // told us, and deleting a misconfigured tool should not erase its leads.
  const captured = db
    .select({ id: toolInvocations.id })
    .from(toolInvocations)
    .where(eq(toolInvocations.toolId, id))
    .all()

  db.delete(botTools).where(eq(botTools.toolId, id)).run()
  db.delete(tools).where(eq(tools.id, id)).run()

  return NextResponse.json({ ok: true, keptInvocations: captured.length })
}
