import * as openai from './openai'
import * as gemini from './gemini'
import type { ProviderKind } from '../provider-kinds'
import type { ModelChoice, ProviderRequest, ProviderResponse } from './types'

/**
 * The vendor translators, keyed by provider kind.
 *
 * Everything above this line works in `ProviderRequest`/`ProviderResponse`;
 * everything below knows one SDK's wire format and nothing else.
 */
export interface ProviderModule {
  generate(req: ProviderRequest): Promise<ProviderResponse>
  /** What the key can actually reach, for the model picker. */
  listModels(apiKey: string): Promise<ModelChoice[]>
}

const MODULES: Record<ProviderKind, ProviderModule> = { openai, gemini }

export function getProviderModule(kind: ProviderKind): ProviderModule {
  return MODULES[kind]
}

export type { ModelChoice, ProviderRequest, ProviderResponse, TokenUsage } from './types'
