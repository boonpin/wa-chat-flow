import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  AgentSetupError,
  getAgentBusinessProfile,
  saveAgentBusinessProfile,
} from '@/lib/settings/business'

export async function GET(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(
    getAgentBusinessProfile(req.nextUrl.searchParams.get('botId') ?? undefined),
  )
}
export async function PUT(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return NextResponse.json({ error: 'Send the AI agent details as JSON.' }, { status: 400 })
  try {
    return NextResponse.json(saveAgentBusinessProfile(body))
  } catch (error) {
    if (error instanceof AgentSetupError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}
