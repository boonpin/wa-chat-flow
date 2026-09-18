export type ImpactRange = 7 | 30 | 90

export interface ImpactActuals {
  aiReplies: number
  humanReplies: number
  automationRate: number | null
  conversationsAssisted: number
  contactsAssisted: number
  medianAiResponseMs: number | null
  medianHumanResponseMs: number | null
}

export interface ImpactUsage {
  calls: number
  failedCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  pricedCalls: number
  unpricedCalls: number
  untrackedReplies: number
  costMicros: number
  costComplete: boolean
}

export interface ImpactEstimates {
  savedMinutes: number | null
  laborValueMicros: number | null
  aiCostMicros: number | null
  netSavingsMicros: number | null
  serviceCostMicros: number | null
  recurringCostMicros: number | null
}

export interface ImpactPeriodSummary {
  actuals: ImpactActuals
  usage: ImpactUsage
  estimates: ImpactEstimates
}

export interface ImpactTrendPoint {
  date: string
  aiReplies: number
  humanReplies: number
  savedMinutes: number | null
  tokens: number
}

export interface ImpactBreakdownRow {
  key: string
  botName: string | null
  kind: string
  model: string
  replies: number
  conversations: number
  calls: number
  failedCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costMicros: number
  costComplete: boolean
  savedMinutes: number | null
  laborValueMicros: number | null
  netSavingsMicros: number | null
}

export interface ImpactRateOption {
  kind: string
  model: string
  inputRatePerMillion: number | null
  outputRatePerMillion: number | null
  effectiveFrom: string | null
}

export interface ImpactAssumptions {
  manualReplyMinutes: number | null
  laborCostMinor: number | null
  currency: string
  subscriptionCostMinor: number | null
  otherMonthlyCostMinor: number | null
  billingAnchor: string | null
  aiCostIncluded: boolean
  rates: ImpactRateOption[]
}

export interface ImpactReport {
  rangeDays: ImpactRange
  period: { from: string; to: string }
  previousPeriod: { from: string; to: string }
  current: ImpactPeriodSummary
  previous: ImpactPeriodSummary
  trend: ImpactTrendPoint[]
  breakdown: ImpactBreakdownRow[]
  assumptions: ImpactAssumptions
  generatedAt: string
}
