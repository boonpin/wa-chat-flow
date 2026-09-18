/** Shared Settings hierarchy; existing module URLs remain bookmarkable. */
export const SETTINGS_SECTIONS = [
  {
    key: 'agents',
    href: '/bots',
    label: 'AI agents',
    detail: 'Create and maintain agents for sales, support or different customer groups.',
    paths: ['/bots', '/settings/business', '/settings'],
  },
  {
    key: 'channels',
    href: '/channels/whatsapp',
    label: 'Channels',
    detail: 'Connect a business number or repair its connection.',
    paths: ['/channels', '/wa'],
  },
  {
    key: 'replies',
    href: '/automation/replies',
    label: 'Automatic replies',
    detail: 'Choose when AI may reply and your workspace default agent.',
    paths: ['/automation/replies'],
  },
  {
    key: 'details',
    href: '/tools',
    label: 'Tools',
    detail: 'Choose what each agent collects and where those details are saved.',
    paths: ['/tools'],
  },
  {
    key: 'savings',
    href: '/reports/impact',
    label: 'Savings estimates',
    detail: 'Your usual reply time, hourly cost and service charges.',
    paths: ['/reports/impact'],
  },
  {
    key: 'technical',
    href: '/settings/technical',
    label: 'Technical settings',
    detail: 'AI connections, Google Sheets setup, Activity and workspace preferences.',
    paths: ['/settings/technical', '/ai-providers', '/activity', '/logs'],
  },
] as const

/** One entry per surface a conversation can arrive on; WhatsApp is the only one today. */
export const CHANNEL_SECTIONS = [
  {
    key: 'whatsapp',
    href: '/channels/whatsapp',
    label: 'WhatsApp numbers',
    paths: ['/channels/whatsapp', '/wa'],
  },
] as const

export const TECHNICAL_SECTIONS = [
  {
    key: 'connections',
    href: '/ai-providers',
    label: 'AI connections',
    paths: ['/ai-providers', '/settings/technical'],
  },
  {
    key: 'sheets',
    href: '/settings/technical/google-sheets',
    label: 'Google Sheets',
    paths: ['/settings/technical/google-sheets'],
  },
  { key: 'activity', href: '/activity', label: 'Activity', paths: ['/activity', '/logs'] },
  {
    key: 'workspace',
    href: '/settings/technical/workspace',
    label: 'Workspace preferences',
    paths: ['/settings/technical/workspace'],
  },
] as const

export function getChannelSection(pathname: string) {
  return CHANNEL_SECTIONS.find((section) =>
    section.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  )
}

export function getTechnicalSection(pathname: string) {
  return TECHNICAL_SECTIONS.find((section) =>
    section.paths.some(
      (path) =>
        pathname === path || (path !== '/settings/technical' && pathname.startsWith(`${path}/`)),
    ),
  )
}

export function getSettingsSection(pathname: string) {
  return SETTINGS_SECTIONS.find((section) =>
    section.paths.some(
      (path) => pathname === path || (path !== '/settings' && pathname.startsWith(`${path}/`)),
    ),
  )
}
