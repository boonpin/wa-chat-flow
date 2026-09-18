# WA Robot design system

**The canonical contract is [docs/ux-revamp/design-system.md](../docs/ux-revamp/design-system.md).**
That document owns the tokens, the component contracts, the responsive rules and
the accessibility criteria. This file is a pointer plus the implementation notes
that only matter once the code exists — it deliberately does not restate the
token table, because two full token documents will diverge.

Adopted and implemented across the app on 6 September 2026.

## Where the contract lives in code

| Contract | Implementation |
| --- | --- |
| Colour, type, spacing, radius, depth, motion tokens | [app/globals.css](../app/globals.css) |
| Typeface (Source Sans 3, self-hosted via next/font) | [app/layout.tsx](../app/layout.tsx) |
| Buttons, fields, panels, tables, overlays, feedback, status | [components/ui/](../components/ui/) |
| Reply status line and the status vocabulary | [components/ui/status.tsx](../components/ui/status.tsx) |
| Shared transcript and composer | [components/transcript.tsx](../components/transcript.tsx) |
| Capture detail, shared by Tools and Activity | [components/capture-detail.tsx](../components/capture-detail.tsx) |
| Shell, navigation groups, connection summary | [app/(dashboard)/layout.tsx](<../app/(dashboard)/layout.tsx>) |

`globals.css` carries the contract's own token names in `:root` and aliases them
into short Tailwind utility names in `@theme inline`. Change both together, and
change the canonical document first.

## Implementation decisions worth keeping

- **Overlays are the native `<dialog>` element**, driven by `showModal()`. Focus
  containment, Escape, top-layer placement and focus restoration come from the
  platform; only the scroll lock and backdrop click are ours. The element stays
  mounted while closed — unmounting it skips the browser's focus restore — and
  `data-initial-focus` names the button that should hold focus, so a destructive
  confirmation starts on Cancel rather than on the destructive action.
- **`useAsyncData`** (components/ui/async.ts) is the one async convention:
  first-load vs refresh, stale-response guards, and last-good retention so a
  dropped poll never blanks a screen someone is reading. `request()` turns every
  non-OK response into an error instead of an empty array.
- **Tables stack below `md`** on Contacts and Campaigns. A contained side-scroll
  is fine for Activity, but not where the row's controls are the point of the
  page — they end up off the edge of the screen.
- **`PageHeader` stacks title and actions below `sm`**, otherwise the primary
  action squeezes the description into a column of single words at 320px.
- **Density**: 40px controls on a pointer, 44px on touch; 16px input text on
  phones so iOS does not zoom. Panels are 16px operational / 24px configuration.

## Things the UI must keep being honest about

These are behaviours of the current backend, not bugs in the UI. Changing the
copy without changing the backend would make the app lie.

- A channel status is what the gateway last reported. The sessions API falls back
  to the stored status when the gateway is unreachable and does not say which one
  you got — hence "Reported connected" and a visible last-checked time.
- `sent` means the gateway accepted the message. It is not delivered or read.
- A stored API key or sheet credential means *saved*, never *tested*.
- Inbox uses server-filtered pages of 25 and full-record queue totals. Legacy list
  consumers retain the 100-record cap; transcripts retain a 200-message cap.
  Activity supplies paginated history. Do not imply the visible transcript is complete.
- Cancelling a campaign marks **every** recipient skipped, including ones already
  sent. The cancel confirmation says so rather than pretending the list still
  distinguishes them.
- `systemSettings.defaultBotId` and the legacy `aiBots.isDefault` flag can
  disagree. `resolveFallbackBot()` reports which one actually answers and
  surfaces the conflict instead of silently picking one.

## Impact report pattern

Adopted 16 September 2026. The human is an SME owner checking whether automation
is worth keeping. The report should feel like a short evidence review, not an
advertising dashboard.

- **Focal pattern:** AI reply turns → estimated time → staff-time value − subscription, other charges and separately billed AI →
  estimated value after costs. Recorded facts and estimates remain visually and
  verbally distinct, and every estimate names its assumptions.
- **Metric figure:** 12px/500 secondary label · 28px/600 tabular primary value ·
  12–13px supporting or comparison copy. Do not uppercase labels.
- **Period control:** real links for 7, 30 and 90 days, 40px high. The current
  range uses the selected surface, stronger weight and `aria-current`.
- **Estimate notice:** amber inset surface, plain-language reason and one direct
  action. Missing prices are incomplete data, never zero cost.
- **Breakdown:** name/purpose first, numeric columns right-aligned, deleted
  records remain visible, and incomplete costs are marked in text.
- **Panels:** quiet border, no lift, 16px phone / 20px desktop padding. Charts
  use semantic surfaces and include a readable table equivalent.

## SME workflow patterns — 16 September 2026

- Inbox and Dashboard lead navigation. Settings groups infrequent setup and has content navigation within Technical settings. Multiple AI agents remain visible in the business group; they are not an advanced-only capability.
- Takeover changes this conversation only. Contact defaults affect future threads. Sending while in AI mode says “Take over and send”.
- Ownership and lifecycle are separate; enabled AI is never represented as active generation.
- Segmented controls wrap at phone widths, use 44px touch targets, and support arrow/Home/End selection.
- Dashboard and report share BusinessValue; unknown amounts are not zero. Included AI is never subtracted twice. Past estimates use current assumptions, explicitly disclosed.
- Activity starts with contacts grouped by stable ID. A conversation timeline reads oldest first; contact/global events read latest first. Manual Refresh preserves reading order.
- Guided preview has no tools or message transport; it may incur AI charges. Prompt handoff instructions do not imply a staff notification occurred.

## Multiple-agent scope

Single tenancy is one business, not one AI robot. Use **AI agents** for the existing
AI Bot management surface, **Agent** for a selection, and show the chosen name in
conversation status. Each guided profile and preview targets one agent. Existing
custom prompts require explicit confirmation before guided replacement; preserve
provider, enabled/default state and collection tools. Contacts sets future selection;
Inbox sets the active selection. Team-assigned groups are not automatic classification.

## Settings and Help content navigation

SettingsNavigation sits above Settings module headings inside main. Real-link RouteTabs
list AI agents, WhatsApp numbers, Automatic replies, Customer details, Savings estimates
and Technical settings. Settings opens AI agents; there is no Overview tab.
Agent children select AI agents. Provider, Activity and technical subroutes select Technical settings.
TechnicalSettingsFrame adds a 200px side navigation inside the content container: AI connections,
Google Sheets, Activity and Workspace preferences. It becomes a two-column link group above
content on phones. Google Sheets shares the collection editor and preserves its technical route
on save/cancel. Start-page preferences live under Workspace preferences.
HelpNavigation has Using the app and Setup & troubleshooting tabs. Access/setup and Google
Sheets reference articles belong to the latter. Configuration stays in Settings.
Use 44px touch targets (40px desktop), visible focus and aria-current. Daily-work pages omit
Settings navigation. Labels and route ownership come from lib/settings/navigation.ts.
