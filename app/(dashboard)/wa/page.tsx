import { redirect } from 'next/navigation'

/** Old bookmark. The module is now WhatsApp numbers. */
export default function LegacyWaPage() {
  redirect('/channels/whatsapp')
}
