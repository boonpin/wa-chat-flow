import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { v4 as uuidv4 } from 'uuid'
import { readToolInput, toPublicTool } from './serialize'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(db.select().from(tools).all().map(toPublicTool))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { input, error } = readToolInput(await req.json().catch(() => ({})))
  if (error) return NextResponse.json({ error }, { status: 400 })

  if (!input.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!input.description) {
    return NextResponse.json(
      { error: 'description is required — it is what tells the AI when to use this tool' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const id = uuidv4()

  try {
    db.insert(tools)
      .values({
        id,
        name: input.name,
        kind: input.kind ?? 'sheet_capture',
        description: input.description,
        sinkType: input.sinkType ?? 'apps_script',
        sinkUrl: input.sinkUrl ?? null,
        sinkSecret: input.sinkSecret ?? null,
        spreadsheetUrl: input.spreadsheetUrl ?? null,
        sheetTab: input.sheetTab ?? 'Sheet1',
        fields: input.fields ?? '[]',
        enabled: input.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      })
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
