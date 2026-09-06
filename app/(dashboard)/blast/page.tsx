import { redirect } from 'next/navigation'

/** Old bookmark. Blast is now Campaigns. */
export default function LegacyBlastPage() {
  redirect('/campaigns')
}
