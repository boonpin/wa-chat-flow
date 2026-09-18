export const HELP_TASKS: {
  section: 'using' | 'setup'
  title: string
  steps: { text: string; href?: string }[]
}[] = [
  {
    section: 'setup',
    title: 'Start replying automatically',
    steps: [
      {
        text: 'Create an AI agent for a customer group and try a question.',
        href: '/bots',
      },
      { text: 'Connect a WhatsApp number and scan the QR code.', href: '/channels/whatsapp' },
      {
        text: 'Choose agents for your customers, or use the workspace default.',
        href: '/contacts',
      },
      { text: 'Enable AI replies for the workspace.', href: '/automation/replies' },
      {
        text: 'Message the number from another phone and read the reply in Inbox.',
        href: '/inbox',
      },
    ],
  },
  {
    section: 'using',
    title: 'Take over a conversation from the AI',
    steps: [
      { text: 'Open the conversation in Inbox.', href: '/inbox' },
      {
        text: 'Choose “Take over” to pause AI for this conversation. An already-started send can still arrive.',
      },
      { text: 'Write and send your reply. Future conversation preferences stay unchanged.' },
    ],
  },
  {
    section: 'using',
    title: 'Let AI help again',
    steps: [
      { text: 'Open the conversation and choose “Let AI reply”.', href: '/inbox' },
      { text: 'The assistant can answer eligible customer messages still waiting for a reply.' },
      {
        text: 'If AI is paused for everyone, resume it in Automatic replies first.',
        href: '/automation/replies',
      },
    ],
  },
  {
    section: 'using',
    title: 'Check the time and cost value',
    steps: [
      { text: 'Review what the assistant helped with on Dashboard.', href: '/dashboard' },
      {
        text: 'Open Time & costs and confirm your usual reply time, staff cost and monthly charges.',
        href: '/reports/impact#assumptions',
      },
      {
        text: 'Estimated staff-time value is time available for other work, not cash saved. Missing costs remain incomplete.',
      },
    ],
  },
  {
    section: 'setup',
    title: 'Recover a lead that did not reach the sheet',
    steps: [
      {
        text: 'Open Activity, choose the customer and inspect the saved details.',
        href: '/activity',
      },
      {
        text: 'Read whether it says “Not submitted” (setup problem) or “Sync failed” (rejected request).',
      },
      { text: 'Fix the sheet setup if needed, then retry the sync. The details were never lost.' },
    ],
  },
  {
    section: 'setup',
    title: 'Repair a number that stopped receiving messages',
    steps: [
      { text: 'Open WhatsApp numbers and find the number.', href: '/channels/whatsapp' },
      { text: 'Connect it again and scan the QR code from the business phone.' },
      { text: 'A status here is what the gateway last reported, not a live guarantee.' },
    ],
  },
]
