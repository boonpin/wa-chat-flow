import { redirect } from 'next/navigation'

/** Keeps a link to a specific campaign working, not just the list. */
export default async function LegacyCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/campaigns/${id}`)
}
