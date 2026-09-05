import { WahaProvider } from './waha-provider'
import type { WhatsAppProvider } from './types'

/**
 * The single place the application resolves its WhatsApp transport.
 *
 * Business logic imports `getProvider()` and never the concrete class, so
 * adding a second transport (Meta Cloud API, another gateway) is a change here
 * and nowhere else.
 */
let instance: WhatsAppProvider | null = null

export function getProvider(): WhatsAppProvider {
  if (!instance) {
    instance = new WahaProvider()
  }
  return instance
}

export type { WhatsAppProvider } from './types'
