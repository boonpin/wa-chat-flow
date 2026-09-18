import { db } from '@/lib/db'
import { businessProfiles, aiBots, aiProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export interface BusinessDetails {
  agentRole: string
  businessName: string
  openingHours: string
  services: string
  commonQuestions: string
  language: string
  handoffRules: string
}
export function businessInstructions(profile: BusinessDetails) {
  return [
    `You are an AI agent answering customer enquiries for ${profile.businessName}.`,
    `Your role and customer group: ${profile.agentRole || 'General customer enquiries.'}`,
    `Opening hours: ${profile.openingHours || 'Not supplied; ask the team rather than guessing.'}`,
    `Services and prices: ${profile.services || 'Not supplied; do not invent details.'}`,
    `Common questions and answers:\n${profile.commonQuestions || 'Not supplied.'}`,
    `Reply language: ${profile.language || 'Use the customer’s language when possible.'}`,
    `Ask a person to help when: ${profile.handoffRules || 'You do not know the answer, or the customer asks for a person.'}`,
    'Use only the supplied business facts. Be concise and friendly. Never claim a sale, booking, payment or handover has happened unless the system confirms it.',
    'If human help is needed, tell the customer that the team needs to review the enquiry. Do not promise an immediate response.',
  ].join('\n\n')
}

export class AgentSetupError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

export function getAgentBusinessProfile(botId?: string) {
  const profile = db
    .select()
    .from(businessProfiles)
    .where(botId ? eq(businessProfiles.botId, botId) : eq(businessProfiles.id, 'default'))
    .get()
  if (!profile?.botId) return null
  const bot = db.select().from(aiBots).where(eq(aiBots.id, profile.botId)).get()
  return bot ? { ...profile, agentName: bot.name } : null
}

/** Guided details belong to one agent; updating them never edits other agents or routing. */
export function saveAgentBusinessProfile(body: Record<string, unknown>) {
  if ('newAgent' in body && typeof body.newAgent !== 'boolean')
    throw new AgentSetupError('Choose whether to add a new AI agent.')
  if ('botId' in body && (typeof body.botId !== 'string' || !body.botId))
    throw new AgentSetupError('Choose an AI agent to edit.')
  if (body.newAgent && body.botId)
    throw new AgentSetupError('Choose either a new agent or an existing agent.')
  const fields = {} as BusinessDetails
  for (const key of [
    'agentRole',
    'businessName',
    'openingHours',
    'services',
    'commonQuestions',
    'language',
    'handoffRules',
  ] as const) {
    const value = key === 'agentRole' && body[key] === undefined ? '' : body[key]
    if (typeof value !== 'string' || value.length > 12000)
      throw new AgentSetupError(
        'Complete the business fields using text (up to 12,000 characters each).',
      )
    fields[key] = value.trim()
  }
  if (!fields.businessName) throw new AgentSetupError('Enter your business name.')
  const requestedId = typeof body.botId === 'string' ? body.botId : undefined
  const existing = body.newAgent
    ? undefined
    : db
        .select()
        .from(businessProfiles)
        .where(
          requestedId
            ? eq(businessProfiles.botId, requestedId)
            : eq(businessProfiles.id, 'default'),
        )
        .get()
  const targetId = requestedId ?? existing?.botId
  const boundBot = targetId
    ? db.select().from(aiBots).where(eq(aiBots.id, targetId)).get()
    : undefined
  if (requestedId && !boundBot) throw new AgentSetupError('This AI agent no longer exists.', 404)
  if (boundBot && boundBot.handlerType !== 'direct')
    throw new AgentSetupError('Use the custom-instruction editor for this agent type.')
  if (
    boundBot &&
    body.expectedUpdatedAt !== undefined &&
    body.expectedUpdatedAt !== boundBot.updatedAt
  )
    throw new AgentSetupError('This AI agent changed. Refresh before saving.', 409)
  if (
    boundBot &&
    (!existing || boundBot.prompt !== businessInstructions(existing)) &&
    body.replaceInstructions !== true
  )
    throw new AgentSetupError(
      'Confirm replacing this agent’s custom instructions with guided details. Other agents and its collection settings will stay as they are.',
      409,
    )
  const name =
    body.agentName === undefined
      ? (boundBot?.name ?? `${fields.businessName} agent`)
      : body.agentName
  if (typeof name !== 'string' || !name.trim() || name.length > 200)
    throw new AgentSetupError('Give this AI agent a name (up to 200 characters).')
  if (boundBot && !boundBot.providerId)
    throw new AgentSetupError('Choose an AI connection for this agent in the custom editor first.')
  const providerId = boundBot?.providerId ?? body.providerId
  const provider =
    typeof providerId === 'string'
      ? db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).get()
      : undefined
  if (!provider)
    throw new AgentSetupError('Choose an AI connection. Technical support can add one in Settings.')
  const now = new Date().toISOString(),
    botId = boundBot?.id ?? uuidv4()
  db.transaction((tx) => {
    if (boundBot)
      tx.update(aiBots)
        .set({ name: name.trim(), prompt: businessInstructions(fields), updatedAt: now })
        .where(eq(aiBots.id, botId))
        .run()
    else
      tx.insert(aiBots)
        .values({
          id: botId,
          name: name.trim(),
          prompt: businessInstructions(fields),
          providerId: provider.id,
          handlerType: 'direct',
          enabled: true,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    tx.insert(businessProfiles)
      .values({
        id: existing?.id ?? (!requestedId && !body.newAgent ? 'default' : botId),
        ...fields,
        botId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: businessProfiles.id,
        set: { ...fields, botId, updatedAt: now },
      })
      .run()
  })
  return { ...fields, botId, agentName: name.trim(), updatedAt: now }
}
