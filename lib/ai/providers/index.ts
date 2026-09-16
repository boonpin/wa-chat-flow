import * as openai from './openai'
import * as gemini from './gemini'
import type { ProviderKind } from '../provider-kinds'
import type {
  DescribeRequest,
  DescribeResponse,
  ModelCapability,
  ModelChoice,
  ProviderRequest,
  ProviderResponse,
} from './types'

/**
 * The vendor translators, keyed by provider kind.
 *
 * Everything above this line works in `ProviderRequest`/`ProviderResponse`;
 * everything below knows one SDK's wire format and nothing else.
 */
export interface ProviderModule {
  generate(req: ProviderRequest): Promise<ProviderResponse>
  /** What the key can actually reach, for the model picker. */
  listModels(apiKey: string, capability: ModelCapability): Promise<ModelChoice[]>
  /**
   * Describes one or more images, and transcribes a voice note.
   *
   * Optional, so a vendor that cannot do it needs no stub: a missing function
   * lands on exactly the same "not supported" path as a capability an operator
   * switched off, and the customer is told the same thing either way.
   */
  describeImages?(req: DescribeRequest): Promise<DescribeResponse>
  transcribeAudio?(req: DescribeRequest): Promise<DescribeResponse>
}

const MODULES: Record<ProviderKind, ProviderModule> = { openai, gemini }

export function getProviderModule(kind: ProviderKind): ProviderModule {
  return MODULES[kind]
}

export type {
  DescribeRequest,
  DescribeResponse,
  MediaPart,
  ModelCapability,
  ModelChoice,
  ProviderRequest,
  ProviderResponse,
  TokenUsage,
} from './types'
