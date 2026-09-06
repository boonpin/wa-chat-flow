import { redirect } from 'next/navigation'

/** Old bookmark. The module is now WhatsApp channels. */
export default function LegacyWaPage() {
  redirect('/channels/whatsapp')
}
