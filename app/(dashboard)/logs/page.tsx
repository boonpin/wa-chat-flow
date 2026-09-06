import { redirect } from 'next/navigation'

/** Old bookmark. Logs is now Activity. */
export default function LegacyLogsPage() {
  redirect('/activity')
}
