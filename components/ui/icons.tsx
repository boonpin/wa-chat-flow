import type { SVGProps } from 'react'

/**
 * One icon set at one weight. Icons are decorative here — every one of them
 * sits next to a text label or inside a control that carries its own
 * accessible name, so they are hidden from assistive technology.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const OverviewIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>
)
export const InboxIcon = (p: IconProps) => (
  <Icon {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></Icon>
)
export const ContactsIcon = (p: IconProps) => (
  <Icon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></Icon>
)
export const BotIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="9" width="18" height="11" rx="2.5" /><path d="M12 9V5.5M9.5 3.5h5" /><path d="M8.5 14v1.5M15.5 14v1.5" /></Icon>
)
export const ToolIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z" /></Icon>
)
export const CampaignIcon = (p: IconProps) => (
  <Icon {...p}><path d="m3 11 18-6-6 18-3.5-8L3 11Z" /></Icon>
)
export const ReplySettingsIcon = (p: IconProps) => (
  <Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /><path d="M8.5 10h7M8.5 13.5h4" /></Icon>
)
export const WhatsAppIcon = (p: IconProps) => (
  <Icon {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></Icon>
)
export const ActivityIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h16M4 10.5h16M4 15h10M4 19.5h7" /></Icon>
)
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.6.75 1 1.4 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></Icon>
)
export const HelpIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5" /><path d="M12 16.8h.01" /></Icon>
)
export const SignOutIcon = (p: IconProps) => (
  <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>
)
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m20 6-11 11-5-5" /></Icon>
export const ChevronRight = (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>
export const ChevronLeft = (p: IconProps) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>
export const ChevronDown = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
export const ArrowLeft = (p: IconProps) => <Icon {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
export const AlertTriangleIcon = (p: IconProps) => (
  <Icon {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5V13M12 16.5h.01" /></Icon>
)
export const AlertCircleIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V13M12 16.5h.01" /></Icon>
)
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16.5V11M12 7.6h.01" /></Icon>
)
export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></Icon>
)
export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></Icon>
)
export const EditIcon = (p: IconProps) => (
  <Icon {...p}><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></Icon>
)
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-.8 13a2 2 0 0 1-2 1.9H7.8a2 2 0 0 1-2-1.9L5 6" /></Icon>
)
export const SendIcon = (p: IconProps) => <Icon {...p}><path d="m3 11 18-6-6 18-3.5-8L3 11Z" /></Icon>
export const MenuIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18.5h2" /></Icon>
)
export const SheetIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3.5" width="18" height="17" rx="2" /><path d="M3 9h18M3 15h18M9.5 9v11.5M15 9v11.5" /></Icon>
)
export const UserIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></Icon>
)
export const PauseIcon = (p: IconProps) => <Icon {...p}><path d="M9.5 4.5v15M14.5 4.5v15" /></Icon>
export const PlayIcon = (p: IconProps) => <Icon {...p} strokeLinejoin="round"><path d="M6.5 4.8v14.4L19 12 6.5 4.8Z" /></Icon>

/** The only icon that is ever animated, and only while something is pending. */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`anim-spin ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
