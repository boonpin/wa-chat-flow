import { redirect } from 'next/navigation'

export default function LegacyBlastCreatePage() {
  redirect('/campaigns/new')
}
