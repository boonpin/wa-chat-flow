import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts, toolInvocations, tools } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

/** Every capture attempt, newest first. `?status=failed` narrows to what needs a retry. */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

  const query = db
    .select({
      id: toolInvocations.id,
      toolId: toolInvocations.toolId,
      toolName: tools.name,
      sheetTab: tools.sheetTab,
      conversationId: toolInvocations.conversationId,
      contactId: toolInvocations.contactId,
      contactName: contacts.name,
      contactPhone: contacts.phoneNumber,
      args: toolInvocations.args,
      status: toolInvocations.status,
      error: toolInvocations.error,
      createdAt: toolInvocations.createdAt,
      syncedAt: toolInvocations.syncedAt,
    })
    .from(toolInvocations)
    .leftJoin(tools, eq(toolInvocations.toolId, tools.id))
    .leftJoin(contacts, eq(toolInvocations.contactId, contacts.id))
    .where(status ? eq(toolInvocations.status, status) : undefined)
    .orderBy(desc(toolInvocations.createdAt))
    .limit(limit)

  const rows = query.all()

  return NextResponse.json(
    rows.map((row) => ({ ...row, args: safeParse(row.args) }))
  )
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}
