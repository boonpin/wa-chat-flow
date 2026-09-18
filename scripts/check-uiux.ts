/** Regression scenarios for ownership, queue totals, period costs and contact histories. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq, sql } from 'drizzle-orm'

async function main() {
  const testDir = mkdtempSync(join(tmpdir(), 'wa-uiux-check-'))
  process.env.DATA_DIR = testDir
  process.env.ADMIN_EMAIL = ''
  process.env.ADMIN_PASSWORD = ''
  process.env.WAHA_BASE_URL = 'http://127.0.0.1:1'
  // Upgrade a populated pre-enhancement database, then exercise the upgraded schema.
  const oldMigrations = join(testDir, 'old-migrations')
  cpSync('drizzle', oldMigrations, { recursive: true })
  const journalFile = join(oldMigrations, 'meta/_journal.json')
  const journal = JSON.parse(readFileSync(journalFile, 'utf8'))
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 10)
  writeFileSync(journalFile, JSON.stringify(journal))
  const oldDb = new Database(join(testDir, 'app.db'))
  migrate(drizzle(oldDb), { migrationsFolder: oldMigrations })
  const oldTime = new Date().toISOString()
  oldDb
    .prepare(
      'INSERT INTO contacts (id, phone_number, ai_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('old-pref', '601999', 1, oldTime, oldTime)
  oldDb
    .prepare(
      'INSERT INTO conversations (id, contact_id, mode, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('old-conversation', 'old-pref', 'human', 'resolved', oldTime, oldTime)
  oldDb
    .prepare(
      'INSERT INTO ai_usage (id, kind, model, input_tokens, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('old-known', 'openai', 'test-model', 100, oldTime)
  oldDb
    .prepare('INSERT INTO ai_usage (id, kind, model, created_at) VALUES (?, ?, ?, ?)')
    .run('old-unknown', 'openai', 'test-model', oldTime)
  oldDb
    .prepare(
      'INSERT INTO ai_bots (id, name, prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('old-assistant', 'Legacy assistant', 'test', oldTime, oldTime)
  oldDb.prepare('UPDATE contacts SET ai_bot_id = ? WHERE id = ?').run('old-assistant', 'old-pref')
  oldDb
    .prepare(
      'INSERT INTO ai_providers (id, name, kind, model, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run('old-provider', 'Legacy connection', 'openai', 'test-model', 'synthetic', oldTime, oldTime)
  oldDb
    .prepare('UPDATE ai_bots SET provider_id = ? WHERE id = ?')
    .run('old-provider', 'old-assistant')
  // Also upgrade a persisted singleton guided profile from immediately before migration 0013.
  journal.entries = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')).entries.filter(
    (entry: { idx: number }) => entry.idx <= 12,
  )
  writeFileSync(journalFile, JSON.stringify(journal))
  migrate(drizzle(oldDb), { migrationsFolder: oldMigrations })
  oldDb
    .prepare(
      'INSERT INTO business_profiles (id, bot_id, business_name, opening_hours, services, common_questions, language, handoff_rules, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      'default',
      'old-assistant',
      'Legacy shop',
      '9–5',
      'Old services',
      'Old questions',
      'English',
      'Ask the team',
      oldTime,
    )
  oldDb.close()
  const { db, getDb } = await import('../lib/db')
  const {
    contacts,
    waSessions,
    aiProviders,
    aiBots,
    botTools,
    tools,
    messages,
    systemSettings,
    conversationEvents,
    aiUsage,
    aiModelRates,
  } = await import('../lib/db/schema')
  const {
    getOrCreateOpenConversation,
    updateConversation,
    getConversation,
    recordConversationEvent,
  } = await import('../lib/conversation/service')
  const { conversationQueue } = await import('../lib/conversation/attention')
  const { activityView } = await import('../lib/conversation/activity')
  const { getImpactReport, recurringPeriodCost } = await import('../lib/reports/impact')
  const { runAutoReply, persistIncomingMessage } = await import('../lib/messaging/incoming-handler')
  const { getProvider } = await import('../lib/wa/provider')
  const { resolveHandler } = await import('../lib/ai/handler')
  const { resumeConversationReply, cancelAutoReply } = await import(
    '../lib/messaging/reply-scheduler'
  )
  const now = new Date().toISOString()
  try {
    assert.equal(
      db.select().from(contacts).where(eq(contacts.id, 'old-pref')).get()!.aiEnabled,
      true,
    )
    assert.equal(getConversation('old-conversation')!.mode, 'human')
    assert.equal(getConversation('old-conversation')!.replyVersion, 0)
    assert.equal(
      getConversation('old-conversation')!.botId,
      'old-assistant',
      'upgrade preserves the inherited assistant before isolating future defaults',
    )
    assert.equal(
      db.select().from(aiUsage).where(eq(aiUsage.id, 'old-known')).get()!.usageKnown,
      true,
    )
    assert.equal(
      db.select().from(aiUsage).where(eq(aiUsage.id, 'old-unknown')).get()!.usageKnown,
      false,
    )
    db.run(sql`DELETE FROM conversations WHERE id='old-conversation'`)
    db.run(sql`DELETE FROM contacts WHERE id='old-pref'`)
    db.run(sql`DELETE FROM ai_usage WHERE id IN ('old-known','old-unknown')`)
    db.insert(waSessions)
      .values({
        id: 'wa',
        sessionName: 'Business',
        status: 'connected',
        createdAt: now,
        updatedAt: now,
      })
      .run()
    db.insert(aiProviders)
      .values({
        id: 'provider',
        name: 'Test connection',
        kind: 'openai',
        model: 'test-model',
        apiKey: 'synthetic-test-key',
        createdAt: now,
        updatedAt: now,
      })
      .run()
    db.insert(aiBots)
      .values({
        id: 'bot',
        name: 'Test assistant',
        providerId: 'provider',
        prompt: 'test',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    db.update(systemSettings).set({ autoReplyMode: 'all', defaultBotId: 'bot' }).run()
    const bot = db.select().from(aiBots).get()!
    let sends = 0
    getProvider().setTyping = async () => {}
    getProvider().sendText = async () => {
      sends++
      return { ok: true, providerMessageId: `sent-${sends}` }
    }
    const handler = resolveHandler(bot)
    function makeContact(id: string, text = 'Can you help?', mode: 'auto' | 'human' = 'auto') {
      db.insert(contacts)
        .values({
          id,
          phoneNumber: `60${id.replace(/\D/g, '') || '000'}`,
          name: 'Same name',
          aiEnabled: true,
          waSessionId: 'wa',
          createdAt: now,
          updatedAt: now,
        })
        .run()
      const c = getOrCreateOpenConversation({
        contactId: id,
        waSessionId: 'wa',
        defaultMode: mode,
      }).conversation
      db.insert(messages)
        .values({
          id: `incoming-${id}`,
          conversationId: c.id,
          contactId: id,
          provider: 'waha',
          direction: 'incoming',
          senderType: 'customer',
          messageType: 'text',
          content: text,
          status: 'received',
          createdAt: new Date(Date.now() - 5000).toISOString(),
        })
        .run()
      return c
    }
    db.insert(aiBots)
      .values({ ...bot, id: 'future-bot', name: 'Future assistant', isDefault: false })
      .run()
    const c = makeContact('contact1')
    db.update(contacts).set({ aiBotId: 'future-bot' }).where(eq(contacts.id, c.contactId)).run()
    let release!: () => void
    let started!: () => void
    let began = new Promise<void>((r) => {
      started = r
    })
    handler.reply = async (input) => {
      assert.equal(
        input.bot.id,
        'bot',
        'changing the future assistant does not change an open conversation fallback',
      )
      started()
      await new Promise<void>((r) => {
        release = r
      })
      return { text: 'AI answer' }
    }
    let work = runAutoReply(c.id)
    await began
    updateConversation(c.id, { mode: 'human' })
    release()
    await work
    assert.equal(sends, 0, 'takeover during generation suppresses the send')
    assert.equal(
      db.select().from(contacts).where(eq(contacts.id, 'contact1')).get()!.aiEnabled,
      true,
      'conversation takeover preserves future preference',
    )
    assert.ok(
      db
        .select()
        .from(conversationEvents)
        .all()
        .some((e) => e.kind === 'ai_suppressed'),
    )
    assert.equal(conversationQueue({ attention: true }).total, 1)
    assert.equal(
      updateConversation(c.id, { mode: 'auto' }, 0),
      undefined,
      'stale operator cannot overwrite ownership',
    )
    updateConversation(c.id, { mode: 'auto' })
    began = new Promise<void>((r) => {
      started = r
    })
    work = runAutoReply(c.id)
    await began
    db.update(systemSettings)
      .set({ autoReplyMode: 'off', replyVersion: sql`${systemSettings.replyVersion} + 1` })
      .run()
    db.update(systemSettings)
      .set({ autoReplyMode: 'all', replyVersion: sql`${systemSettings.replyVersion} + 1` })
      .run()
    release()
    await work
    assert.equal(sends, 0, 'pause then resume does not revive an old generation')
    updateConversation(c.id, { mode: 'human' })
    recordConversationEvent(c.id, 'mode_changed', 'Your team took over')
    db.insert(messages)
      .values({
        id: 'human-answer',
        conversationId: c.id,
        contactId: c.contactId,
        provider: 'waha',
        direction: 'outgoing',
        senderType: 'human',
        messageType: 'text',
        content: 'We can help',
        status: 'sent',
        createdAt: new Date().toISOString(),
      })
      .run()
    assert.equal(
      conversationQueue({ attention: true }).total,
      0,
      'successful response clears attention',
    )
    updateConversation(c.id, { status: 'resolved' })
    const next = getOrCreateOpenConversation({
      contactId: c.contactId,
      waSessionId: 'wa',
      defaultMode: 'auto',
    }).conversation
    assert.notEqual(next.id, c.id)
    assert.equal(next.mode, 'auto')
    const emoji = makeContact('contact2', '👍', 'human')
    assert.equal(
      conversationQueue({ attention: true }).total,
      0,
      'decoration does not become an overdue enquiry',
    )
    resumeConversationReply(emoji.id)
    assert.equal(getConversation(emoji.id)!.autoReplyDueAt, null)
    const waiting = makeContact('contact3', 'Price please', 'auto')
    resumeConversationReply(waiting.id)
    assert.ok(getConversation(waiting.id)!.autoReplyDueAt)
    cancelAutoReply(waiting.id)
    db.update(systemSettings).set({ autoReplyMode: 'existing' }).run()
    handler.reply = async () => ({ text: 'Handback answer' })
    assert.equal(
      (await runAutoReply(waiting.id)).status,
      'replied',
      'explicit handback can answer a newly created conversation under existing-only policy',
    )
    db.update(systemSettings).set({ autoReplyMode: 'all' }).run()
    for (let i = 4; i <= 33; i++) makeContact(`contact${i}`, 'Need help', 'human')
    const queue = conversationQueue({ attention: true, limit: 5 })
    assert.equal(queue.rows.length, 5)
    assert.equal(queue.total, 30, 'queue totals extend beyond visible page')
    const a = activityView(new URLSearchParams())
    assert.equal(a.rows.length, 25)
    assert.ok(a.nextCursor)
    const b = activityView(
      new URLSearchParams({ cursor: a.nextCursor!, from: a.period.from, to: a.period.to }),
    )
    assert.equal(
      new Set([...a.rows, ...b.rows].map((r) => r.id)).size,
      a.rows.length + b.rows.length,
      'cursor pagination has no overlap at timestamp ties',
    )
    assert.equal(a.total, 33, 'matching names remain separate contacts')
    const history = activityView(new URLSearchParams({ contactId: c.contactId }))
    assert.ok('conversations' in history && history.conversations!.some((x) => x.id === c.id))
    const sending = makeContact('contact34', 'Please answer now', 'auto')
    handler.reply = async () => ({ text: 'Already sending' })
    let releaseSend!: () => void
    let markSendStarted!: () => void
    const sendStarted = new Promise<void>((resolve) => {
      markSendStarted = resolve
    })
    getProvider().sendText = async () => {
      markSendStarted()
      await new Promise<void>((resolve) => {
        releaseSend = resolve
      })
      return { ok: true, providerMessageId: 'already-in-progress' }
    }
    const sendingWork = runAutoReply(sending.id)
    await sendStarted
    assert.ok(
      db
        .select()
        .from(messages)
        .all()
        .some((row) => row.conversationId === sending.id && row.status === 'processing'),
    )
    updateConversation(sending.id, { mode: 'human' })
    releaseSend()
    await sendingWork
    assert.equal(getConversation(sending.id)!.mode, 'human')
    assert.ok(
      db
        .select()
        .from(messages)
        .all()
        .some(
          (row) =>
            row.conversationId === sending.id &&
            row.providerMessageId === 'already-in-progress' &&
            row.status === 'sent',
        ),
      'an already-started send may complete after takeover',
    )
    const costs = {
      subscriptionCostMinor: 9900,
      otherMonthlyCostMinor: 0,
      billingAnchor: '2026-01-01',
    }
    assert.equal(
      recurringPeriodCost(costs, '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
      99_000_000,
    )
    assert.equal(
      recurringPeriodCost(
        { ...costs, billingAnchor: '2026-01-31' },
        '2026-02-28T00:00:00.000Z',
        '2026-03-31T00:00:00.000Z',
      ),
      99_000_000,
      'month-end anchor clamps without drift',
    )
    assert.equal(recurringPeriodCost({ ...costs, subscriptionCostMinor: null }, now, now), null)
    assert.equal(
      recurringPeriodCost(
        { ...costs, billingAnchor: '2026-01-01' },
        '2025-12-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      ),
      0,
      'no recurring cost before subscription starts',
    )
    db.update(systemSettings)
      .set({
        manualReplyMinutes: 2,
        laborCostMinor: 2500,
        subscriptionCostMinor: 9900,
        otherMonthlyCostMinor: 0,
        billingAnchor: '2026-01-01',
        aiCostIncluded: true,
      })
      .run()
    let report = getImpactReport(30)
    assert.ok(
      report.current.estimates.netSavingsMicros! < 0,
      'negative estimated value remains visible',
    )
    db.insert(aiUsage)
      .values({
        id: 'unknown',
        providerId: 'provider',
        botId: 'bot',
        conversationId: c.id,
        kind: 'openai',
        model: 'test-model',
        createdAt: new Date(Date.now() - 1000).toISOString(),
        usageKnown: false,
      })
      .run()
    db.insert(aiModelRates)
      .values({
        id: 'rate',
        kind: 'openai',
        model: 'test-model',
        currency: 'MYR',
        inputRateMicros: 1_000_000,
        outputRateMicros: 2_000_000,
        effectiveFrom: '1970-01-01T00:00:00.000Z',
        createdAt: now,
      })
      .run()
    db.update(systemSettings).set({ aiCostIncluded: false }).run()
    report = getImpactReport(30)
    assert.equal(report.current.usage.costComplete, false, 'unknown usage is not priced as zero')
    assert.equal(
      report.current.estimates.netSavingsMicros,
      null,
      'incomplete separately billed usage hides net estimate',
    )
    db.update(systemSettings).set({ aiCostIncluded: true }).run()
    assert.notEqual(
      getImpactReport(30).current.estimates.serviceCostMicros,
      null,
      'included usage is not charged twice',
    )
    db.insert(messages)
      .values({
        id: 'multi-model-reply',
        conversationId: next.id,
        contactId: c.contactId,
        provider: 'waha',
        direction: 'outgoing',
        senderType: 'ai',
        messageType: 'text',
        content: 'Answer after reading a photo',
        status: 'sent',
        createdAt: now,
      })
      .run()
    for (const [id, stage, model] of [
      ['photo-call', 'vision', 'image-model'],
      ['reply-call', 'reply', 'test-model'],
    ])
      db.insert(aiUsage)
        .values({
          id,
          stage,
          model,
          kind: 'openai',
          botId: 'bot',
          conversationId: next.id,
          messageId: 'multi-model-reply',
          usageKnown: true,
          inputTokens: 100,
          totalTokens: 100,
          status: 'ok',
          createdAt: now,
        })
        .run()
    report = getImpactReport(30)
    assert.equal(
      report.breakdown.reduce((sum, row) => sum + row.replies, 0),
      1,
      'preprocessing and reply models never double-count the same reply value',
    )
    assert.equal(report.breakdown.find((row) => row.model === 'image-model')!.savedMinutes, 0)
    const { saveAgentBusinessProfile, getAgentBusinessProfile, AgentSetupError } = await import(
      '../lib/settings/business'
    )
    const agentDetails = {
      businessName: 'Synthetic shop',
      agentRole: 'Retail sales enquiries',
      openingHours: '9–5 UTC',
      services: 'Retail prices',
      commonQuestions: 'Ask about stock',
      language: 'English',
      handoffRules: 'Refunds need a person',
      providerId: 'provider',
    }
    const sales = saveAgentBusinessProfile({
      ...agentDetails,
      newAgent: true,
      agentName: 'Sales agent',
    })
    const support = saveAgentBusinessProfile({
      ...agentDetails,
      newAgent: true,
      agentName: 'Support agent',
      agentRole: 'Existing customers with support questions',
      services: 'Support and returns',
    })
    assert.notEqual(
      sales.botId,
      support.botId,
      'guided setup can create multiple independent agents',
    )
    const supportBefore = db.select().from(aiBots).where(eq(aiBots.id, support.botId)).get()!
    const defaultBefore = db.select().from(systemSettings).get()!.defaultBotId
    db.insert(tools)
      .values({
        id: 'sales-capture',
        name: 'capture_sales_test',
        description: 'Sales enquiries',
        createdAt: now,
        updatedAt: now,
      })
      .run()
    db.insert(botTools).values({ botId: sales.botId, toolId: 'sales-capture' }).run()
    db.update(aiBots).set({ enabled: false }).where(eq(aiBots.id, sales.botId)).run()
    saveAgentBusinessProfile({
      ...agentDetails,
      botId: sales.botId,
      agentName: 'Wholesale sales',
      agentRole: 'Wholesale customers only',
      expectedUpdatedAt: sales.updatedAt,
    })
    assert.equal(getAgentBusinessProfile(sales.botId)!.agentRole, 'Wholesale customers only')
    assert.deepEqual(
      db.select().from(aiBots).where(eq(aiBots.id, support.botId)).get(),
      supportBefore,
      'editing one agent preserves another agent',
    )
    assert.equal(
      db.select().from(aiBots).where(eq(aiBots.id, sales.botId)).get()!.enabled,
      false,
      'guided saves preserve disabled state',
    )
    assert.equal(
      db.select().from(systemSettings).get()!.defaultBotId,
      defaultBefore,
      'guided saves do not replace the workspace default',
    )
    assert.equal(
      db.select().from(botTools).where(eq(botTools.botId, sales.botId)).get()!.toolId,
      'sales-capture',
    )
    assert.throws(
      () =>
        saveAgentBusinessProfile({
          ...agentDetails,
          botId: sales.botId,
          agentName: 'Stale edit',
          expectedUpdatedAt: '1970-01-01',
        }),
      (error) => error instanceof AgentSetupError && error.status === 409,
    )
    const customBefore = db.select().from(aiBots).where(eq(aiBots.id, 'bot')).get()!
    assert.throws(
      () => saveAgentBusinessProfile({ ...agentDetails, botId: 'bot', agentName: 'Custom agent' }),
      (error) => error instanceof AgentSetupError && error.status === 409,
      'existing custom instructions require explicit conversion',
    )
    assert.deepEqual(db.select().from(aiBots).where(eq(aiBots.id, 'bot')).get(), customBefore)
    assert.equal(
      getAgentBusinessProfile()!.botId,
      'old-assistant',
      'migration retains the original singleton guided agent',
    )
    assert.equal(
      getAgentBusinessProfile()!.agentRole,
      '',
      'migration defaults the new role without overwriting legacy facts',
    )
    assert.equal(getAgentBusinessProfile()!.services, 'Old services')
    const converted = saveAgentBusinessProfile({
      ...agentDetails,
      botId: 'bot',
      agentName: customBefore.name,
      expectedUpdatedAt: customBefore.updatedAt,
      replaceInstructions: true,
    })
    const convertedBot = db.select().from(aiBots).where(eq(aiBots.id, converted.botId)).get()!
    assert.equal(convertedBot.providerId, customBefore.providerId)
    assert.equal(convertedBot.isDefault, customBefore.isDefault)
    assert.equal(convertedBot.createdAt, customBefore.createdAt)
    assert.equal(getAgentBusinessProfile(converted.botId)!.agentRole, agentDetails.agentRole)
    const legacy = saveAgentBusinessProfile({
      ...agentDetails,
      replaceInstructions: true,
      agentName: 'Legacy guided agent',
    })
    assert.equal(
      getAgentBusinessProfile()!.botId,
      legacy.botId,
      'legacy singleton guided data remains accessible',
    )
    assert.equal(
      saveAgentBusinessProfile({ ...agentDetails, agentName: 'Legacy renamed' }).botId,
      legacy.botId,
      'legacy saves retain their original agent',
    )
    db.update(aiBots)
      .set({ prompt: 'A custom wholesale policy' })
      .where(eq(aiBots.id, sales.botId))
      .run()
    assert.throws(
      () =>
        saveAgentBusinessProfile({
          ...agentDetails,
          botId: sales.botId,
          agentName: 'Wholesale sales',
        }),
      (error) => error instanceof AgentSetupError && error.status === 409,
      'custom edits after guided setup still require explicit replacement',
    )
    saveAgentBusinessProfile({
      ...agentDetails,
      botId: sales.botId,
      agentName: 'Wholesale sales',
      agentRole: 'Wholesale customers only',
      replaceInstructions: true,
    })
    db.update(aiBots).set({ enabled: true }).where(eq(aiBots.id, sales.botId)).run()
    const groupPhone = '60188888888'
    db.insert(contacts)
      .values({
        id: 'group-customer',
        phoneNumber: groupPhone,
        name: 'Wholesale customer',
        aiEnabled: true,
        aiBotId: sales.botId,
        waSessionId: 'wa',
        createdAt: now,
        updatedAt: now,
      })
      .run()
    const inbound = (id: string) =>
      persistIncomingMessage({
        provider: 'waha',
        sessionId: 'wa',
        providerMessageId: id,
        chatId: `${groupPhone}@c.us`,
        phone: groupPhone,
        type: 'text',
        text: 'Can you help my business?',
        timestamp: new Date(),
      })
    const first = inbound('group-first')
    assert.equal(first.status, 'stored')
    if (first.status !== 'stored') throw new Error('Missing test conversation')
    assert.equal(
      first.conversation.botId,
      sales.botId,
      'customer selection seeds its conversation agent',
    )
    db.update(contacts)
      .set({ aiBotId: support.botId })
      .where(eq(contacts.id, 'group-customer'))
      .run()
    const continuing = inbound('group-continuing')
    assert.equal(continuing.status, 'stored')
    if (continuing.status !== 'stored') throw new Error('Missing test conversation')
    assert.equal(
      continuing.conversation.botId,
      sales.botId,
      'future preference does not silently change the active agent',
    )
    getProvider().sendText = async () => ({
      ok: true,
      providerMessageId: `agent-sent-${Date.now()}`,
    })
    let activeAgent = ''
    handler.reply = async (input) => {
      activeAgent = input.bot.id
      return { text: input.bot.name }
    }
    await runAutoReply(first.conversation.id)
    assert.equal(activeAgent, sales.botId, 'reply execution uses the selected sales agent')
    updateConversation(first.conversation.id, { status: 'resolved' })
    const later = inbound('group-later')
    assert.equal(later.status, 'stored')
    if (later.status !== 'stored') throw new Error('Missing test conversation')
    assert.equal(
      later.conversation.botId,
      support.botId,
      'a later enquiry uses the newly selected support agent',
    )
    await runAutoReply(later.conversation.id)
    assert.equal(activeAgent, support.botId, 'reply execution uses the selected support agent')
    console.log('UI/UX regression scenarios passed (isolated database, simulated providers).')
  } finally {
    getDb().$client.close()
    rmSync(testDir, { recursive: true, force: true })
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
