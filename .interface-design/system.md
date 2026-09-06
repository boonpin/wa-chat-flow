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
- The conversation list caps at 100 and a transcript at 200 messages, so counts
  on those screens say "recent" rather than implying a total.
- Cancelling a campaign marks **every** recipient skipped, including ones already
  sent. The cancel confirmation says so rather than pretending the list still
  distinguishes them.
- `systemSettings.defaultBotId` and the legacy `aiBots.isDefault` flag can
  disagree. `resolveFallbackBot()` reports which one actually answers and
  surfaces the conflict instead of silently picking one.
