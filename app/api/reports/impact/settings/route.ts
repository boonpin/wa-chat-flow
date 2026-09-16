import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { aiModelRates, systemSettings } from '@/lib/db/schema'
import { getImpactAssumptions } from '@/lib/reports/impact'

interface RateInput {
  kind?: unknown
  model?: unknown
  inputRatePerMillion?: unknown
  outputRatePerMillion?: unknown
}

const CURRENCY = /^[A-Z]{3}$/

function optionalNumber(value: unknown): number | null | 'invalid' {
  if (value === null || value === '') return null
  return typeof value === 'number' && Number.isFinite(value) ? value : 'invalid'
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(getImpactAssumptions())
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Send the report assumptions as JSON.' }, { status: 400 })
  }

  const manualReplyMinutes = optionalNumber(body.manualReplyMinutes)
  if (
    manualReplyMinutes === 'invalid' ||
    (manualReplyMinutes !== null &&
      (!Number.isInteger(manualReplyMinutes) || manualReplyMinutes < 1 || manualReplyMinutes > 240))
  ) {
    return NextResponse.json(
      { error: 'Manual reply time must be a whole number from 1 to 240 minutes.' },
      { status: 400 }
    )
  }

  const laborCostPerHour = optionalNumber(body.laborCostPerHour)
  if (
    laborCostPerHour === 'invalid' ||
    (laborCostPerHour !== null && (laborCostPerHour < 0 || laborCostPerHour > 1_000_000))
  ) {
    return NextResponse.json(
      { error: 'Hourly labor cost must be between 0 and 1,000,000.' },
      { status: 400 }
    )
  }

  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
  if (!CURRENCY.test(currency)) {
    return NextResponse.json({ error: 'Currency must be a three-letter code.' }, { status: 400 })
  }

  const rates = Array.isArray(body.rates) ? (body.rates as RateInput[]) : []
  const parsedRates: {
    kind: string
    model: string
    inputRatePerMillion: number
    outputRatePerMillion: number
  }[] = []

  for (const rate of rates) {
    if (typeof rate.kind !== 'string' || typeof rate.model !== 'string') {
      return NextResponse.json({ error: 'Each model rate needs a provider and model.' }, { status: 400 })
    }
    const input = optionalNumber(rate.inputRatePerMillion)
    const output = optionalNumber(rate.outputRatePerMillion)
    if (input === null && output === null) continue
    if (
      input === 'invalid' ||
      output === 'invalid' ||
      input === null ||
      output === null ||
      input < 0 ||
      output < 0 ||
      input > 1_000_000 ||
      output > 1_000_000
    ) {
      return NextResponse.json(
        { error: `Enter both input and output rates for ${rate.model}, using zero or positive numbers.` },
        { status: 400 }
      )
    }
    parsedRates.push({
      kind: rate.kind,
      model: rate.model,
      inputRatePerMillion: input,
      outputRatePerMillion: output,
    })
  }

  const now = new Date().toISOString()
  db.transaction((tx) => {
    tx.update(systemSettings)
      .set({
        manualReplyMinutes,
        laborCostMinor:
          laborCostPerHour === null ? null : Math.round(laborCostPerHour * 100),
        reportCurrency: currency,
      })
      .where(eq(systemSettings.id, 'default'))
      .run()

    for (const rate of parsedRates) {
      const latest = tx
        .select()
        .from(aiModelRates)
        .where(
          and(
            eq(aiModelRates.kind, rate.kind),
            eq(aiModelRates.model, rate.model),
            eq(aiModelRates.currency, currency)
          )
        )
        .orderBy(desc(aiModelRates.effectiveFrom))
        .limit(1)
        .get()

      const inputRateMicros = Math.round(rate.inputRatePerMillion * 1_000_000)
      const outputRateMicros = Math.round(rate.outputRatePerMillion * 1_000_000)
      if (
        latest &&
        latest.inputRateMicros === inputRateMicros &&
        latest.outputRateMicros === outputRateMicros
      ) {
        continue
      }

      tx.insert(aiModelRates)
        .values({
          id: uuidv4(),
          kind: rate.kind,
          model: rate.model,
          currency,
          inputRateMicros,
          outputRateMicros,
          effectiveFrom: latest ? now : '1970-01-01T00:00:00.000Z',
          createdAt: now,
        })
        .run()
    }
  })

  return NextResponse.json(getImpactAssumptions())
}
