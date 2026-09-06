# WA Robot shared design system

**Status: Phase 1 proposal.** This is the proposed single design contract for all later phases. It is not an already-adopted `.interface-design/system.md`, and no runtime tokens have been changed.

## Direction and rationale

**Domain:** customer enquiry, service counter, conversation, handover, business phone number, lead record, reply permission, exception recovery.

**Color world:** off-white correspondence paper, dark green business signage, charcoal printed receipts, blue handwritten annotations, amber pending-work slips, red corrections. These become a quiet neutral canvas, deep green action, dark ink text, blue AI identity, amber attention and red confirmed failure.

**Signature:** the reply status line separates **channel**, **AI/human reply mode**, **bot/fallback**, and **known blockers**. It appears in the shell, Overview, Inbox, contact profile and setup reviews. The signature is meaningful operational context, not a decorative robot mascot.

**Common defaults replaced:**

| Default temptation | WA Robot decision | Why |
| --- | --- | --- |
| Equal KPI cards leading every dashboard | Known issues and recent conversation work lead Overview; compact counts support them | An owner needs a next action more than a bot count |
| Bright green for every active/successful/AI element | Deep green actions/success; blue AI identity; neutral human mode; explicit labels throughout | Users must distinguish “AI selected” from “connected” |
| Large floating cards, technical model choices first, tiny gray metadata | Compact service-desk rows, behavior-first setup, readable supporting text | Daily density with approachable configuration |

**Intent:** help an SME operator scan work, understand automation scope and act confidently.
**Hierarchy:** each view has one dominant task, one primary action per region, clear saved/live state and restrained secondary data.
**Depth:** subtle shadows for genuinely floating surfaces; content panels sit quietly in the page with fine separators. No decorative card lifting, glass, gradients or brand-colored shadows.
**Surfaces:** same soft neutral for canvas/sidebar, white content, slightly inset fields. No separate dark sidebar world.
**Typography:** Source Sans 3 for readable, open letterforms in conversation text and compact controls; one family at 400/500/600. The [Adobe font project](https://github.com/adobe-fonts/source-sans) describes it as a UI-oriented family. Self-host the font when implementation begins, using `font-display: swap`. Existing Geist may bridge unmigrated pages, but do not mix typefaces within a migrated page. Monospace is for identifiers/raw payloads only, not all business data.
**Spacing:** 4px base. A 16px panel rhythm keeps operational density; 24–32px separates independent decisions. Rounded controls make a dense product approachable without wasting space.

See [the visual specimen](./direction.svg). It demonstrates hierarchy, colors and state treatment; its portable system-font fallback is not a font proof.

## Token architecture

Use primitive → semantic → component layers. Page code consumes semantic/component tokens, not raw hex strings. Prefix domain-specific tokens (`reply-ai`, `reply-human`, `channel-connected`) where the meaning differs from generic success. Keep tokens readable rather than inventing poetic names for every measurement.

Retain Tailwind 4 and map its theme utilities to semantic CSS properties. Refactor the existing shared UI module into focused files as components migrate. Do not add an alternate CSS framework or theme per page.

### Color values

Hex values below are the reference sRGB values for implementation and contrast checks. If generating OKLCH scales, derive them from these anchors and validate the final sRGB rendering; do not substitute guessed OKLCH values or assume uniform lightness guarantees contrast.

| Semantic token | Value | Use |
| --- | --- | --- |
| `--color-surface-canvas` | `#F8FAF9` | Page and navigation canvas |
| `--color-surface-panel` | `#FFFFFF` | Transcript, forms, table surface |
| `--color-surface-overlay` | `#FFFFFF` | Menus, dialogs, drawers |
| `--color-surface-inset` | `#F3F6F4` | Inputs and secondary wells |
| `--color-surface-hover` | `#EDF2EF` | Neutral row/control hover |
| `--color-surface-selected` | `#E4F2EA` | Navigation/row selection, also add shape/weight cue |
| `--color-text-primary` | `#182C23` | Heading, content and values |
| `--color-text-secondary` | `#43564C` | Supporting content, field labels |
| `--color-text-tertiary` | `#64716B` | Metadata and readable placeholders |
| `--color-text-disabled` | `#8A958F` | Disabled-only content; never essential instructions |
| `--color-border-subtle` | `rgba(24,44,35,0.06)` | Quiet row separators |
| `--color-border-default` | `rgba(24,44,35,0.12)` | Panels and grouping boundaries |
| `--color-border-strong` | `#7E8D85` | Identifying field/control boundaries |
| `--color-border-focus` | `#087F5B` | 2px external focus outline with 2px gap |
| `--color-action-primary` | `#087F5B` | Primary action and functional links |
| `--color-action-hover` | `#066749` | Primary hover |
| `--color-action-pressed` | `#05563E` | Primary pressed |
| `--color-action-foreground` | `#FFFFFF` | Primary button text |
| `--color-success-text` / `surface` | `#166534` / `#F0FDF4` | Connected, synced, saved |
| `--color-warning-text` / `surface` | `#92400E` / `#FFFBEB` | Paused dependency, needs setup, attention |
| `--color-danger-text` / `surface` | `#B42318` / `#FEF3F2` | Confirmed failure, destructive action |
| `--color-info-text` / `surface` | `#1D4ED8` / `#EFF6FF` | Informational notices |
| `--color-reply-ai-text` / `surface` | `#1D4ED8` / `#EFF6FF` | AI mode/sender identity, not proof of activity |
| `--color-reply-human-text` / `surface` | `#475569` / `#F1F5F9` | Human mode/sender identity |
| `--color-overlay-scrim` | `rgba(24,44,35,0.32)` | Modal scrim |

Domain aliases: `channel-connected → success`, `channel-failed → danger`, `capture-synced → success`, `capture-pending → info`. Connection identity gets a neutral channel icon/name, never a randomly assigned success color.

Control aliases: `--input-background → surface-inset`, `--input-border → border-strong`, `--input-focus-ring → border-focus`, `--input-error-border → danger-text`, `--input-placeholder → text-tertiary`. Decorative panel borders do not need to identify input boundaries; their intentionally subtle color must not be reused where a visible control outline is necessary.

Measured contrast on these reference pairs:

| Pair | Contrast |
| --- | --- |
| Primary text / canvas | 14.07:1 |
| Secondary text / canvas | 7.49:1 |
| Tertiary text / canvas | 4.87:1 |
| White / primary green | 5.00:1 |
| White / hover green | 6.90:1 |
| Success text / success surface | 6.81:1 |
| Warning text / warning surface | 6.84:1 |
| Danger text / danger surface | 6.05:1 |
| AI text / AI surface | 6.16:1 |
| Human text / human surface | 6.92:1 |
| Control border / inset surface | 3.20:1 |

No alpha reductions on essential labels or status text. Re-check selected, hover, focus, error and disabled surroundings during implementation. Light mode is the shipped direction; dark mode is not added in this revamp. Semantic tokens leave room for a separately validated future theme.

### Typography

Use a roughly 1.2 scale, rounded to usable UI sizes, with explicit exceptions for messages and metadata. Root is 16px; sizes use rem so user zoom remains effective.

| Role | Size / line-height | Weight | Use |
| --- | --- | --- | --- |
| Page title | 28 / 36px | 600 | One h1; 24 / 32px on phone |
| Section heading | 20 / 28px | 600 | Independent task grouping |
| Subsection | 16 / 24px | 600 | Editor sections, drawer headings |
| Conversation body / mobile input | 16 / 24px | 400 | Comfortable reading and typing |
| UI body / desktop input | 14 / 20px | 400 | Forms, rows, descriptions |
| Labels / nav / buttons | 14 / 20px | 500–600 | Control identity and actions |
| Metadata / badges | 12 / 16px | 400–500 | Time, status, secondary facts |
| Operational number | 28 / 36px | 600 | Only when the number informs a decision |
| Technical payload | 12 / 20px | 400 mono | Disclosure content, wrap or contained scroll |

Title tracking −0.02em; body tracking normal. Sentence case throughout; no tiny uppercase interface labels. Use tabular numerals on counts/timestamps, a sans font on phone numbers unless a technical context benefits from mono. Show full timestamps on accessible detail, not hover alone. Message bodies wrap long words/URLs and preserve line breaks. Match text direction to message content when appropriate.

### Spacing, sizing, radius and depth

| Token family | Values / rule |
| --- | --- |
| Spacing | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px |
| Label → field / field → hint | 4px / 4px |
| Between fields / related groups | 16px / 24px |
| Panel padding | 16px operational; 24px configuration; 16px phone |
| Page inset | 24px desktop; 16px phone; Inbox uses the available workspace |
| Navigation | 232px expanded; 56px top context bar; 40px desktop rows, 44px touch rows |
| Default control | 40px high; 44px for touch and sign-in; compact actions 32px in 44px row/target regions |
| Data rows | 48px minimum; 64px for name + supporting detail; content may increase height |
| Conversation rows | 80px minimum for identity, preview and state; allow multiline expansion |
| Content widths | Operational tables fill width; Overview max 1200px; long forms max 760px; prose max 65ch |
| Radius | 4px small inner accents; 8px controls/selected nav; 12px panels/drawers; 16px dialog; full only avatars/status pills |
| Shadow small | `0 1px 2px rgba(24,44,35,0.06)` |
| Shadow popover | `0 4px 16px rgba(24,44,35,0.10)` |
| Shadow dialog/drawer | `0 12px 40px rgba(24,44,35,0.14)` |
| Z-index | Base 0, sticky 10, navigation 20, popover 30, modal 40, toast 50, tooltip 60; overlay children stay above their parent |

Control hit areas must not overlap. Compact visual actions can sit within larger separate targets; do not force a 32px target simply to achieve density. Panels have no default dramatic elevation. Borders separate data; shadows explain overlap.

## Shared component contracts

All controls implement default, hover, pressed/selected, focus-visible, disabled and pending states. Data components implement loading, empty, no results, failed, refreshed/stale and populated states. The table below specifies where the interaction differs.

| Component | Shared contract |
| --- | --- |
| Button / link button | Primary, secondary, ghost, danger. 14px/600, 8px radius, 12–16px horizontal padding. Pending has spinner + verb (“Saving…”), stable width, no repeated submits. Links navigate and buttons act; never nest a button in an anchor. |
| Icon button | Visible tooltip on hover/focus plus accessible action name; 40px desktop / 44px touch. No unlabeled close/send/rename icon. |
| Input / Textarea / Select | Persistent visible label linked by ID; hint/error IDs via `aria-describedby`; `aria-invalid` for error. Default/error share layout. Validate on submit and relevant blur, then clear corrected errors. Do not clear values after failure. |
| Password / credential field | Stored/not stored indicator outside input; blank means keep. Reveal only newly typed value. Explicit replace/remove if endpoint supports it; never retrieve stored secrets. Autocomplete appropriate to credential context. |
| Switch / checkbox | Accessible name includes setting and record context; actual disabled semantics; space toggles. Surrounding copy states scope. Configuration switches use draft semantics; operational switches await acknowledgement. |
| Form section / save footer | Title, one-sentence scope, related fields; footer attached to content, not horizontally offset from viewport. Save/Discard, unsaved state and visible persistent save failure. Dirty-exit dialog prevents accidental loss. |
| Card / panel | A meaningful content group, not a wrapper for every label. 12px radius, subtle border, 16/24px padding. Use semantic section/heading where appropriate. |
| Table / list | Shared toolbar, search/filter state, optional deliberate bulk mode, explicit record link, honest count scope, pagination. Sorting only where real data can be sorted accurately; no inert column chevrons. Numeric alignment consistent. |
| Bulk action bar | Selection scope and count, indeterminate select-all, clear selection, explicit Apply. Pending blocks repeats; result reports success/failure separately and retains failed records for recovery. |
| Tabs | Underlined tabs for subpages; real links for navigation. In-place tab panels use keyboard/ARIA tab behavior. Filter segments are separate named controls, not route tabs. |
| Dialog | One focused confirmation or short task. 440px narrow / 640px form, viewport-constrained; labeled title/description; Escape, focus trap and return. Destructive confirmation defaults focus to Cancel. |
| Drawer | Inspect contact/event/channel while preserving list context. 440px standard / 560px rich detail. Full screen on phone; sticky title/actions, scrollable body, correct modal semantics. No nested drawer stack. |
| Badge | Short state or attribute, 12px/500, text plus appropriate icon. Noninteractive badges do not look like buttons. Variants describe semantics (`success`, `ai`, `human`, `warning`), not arbitrary colors. |
| Status indicator / reply status line | Separate factual dimensions; names the channel and bot. Dot or icon is decorative alongside text. Failed/stale status links to the relevant recovery, not a generic settings page. |
| Navigation | Same canvas, quiet boundary, selected row background + weight + current-page semantics. Group labels distinguish daily work, automation and utility. No unread/issue counts without reliable data. |
| Page header | Breadcrumb where needed, one h1, optional description, one primary action and secondary actions. Wrap/reorder on phone; do not force single-line title/action collisions. |
| Empty state | Distinguish first use, completed work, search mismatch and unavailable data. Short title, why it is empty, one next action if useful. Small functional icon; no oversized emoji or invented metrics. |
| Skeleton / loading | Approximate actual rows/fields; reserve layout; one labeled `aria-busy` region. First load differs from refresh; keep last-good content during refresh. After prolonged loading offer recovery rather than endless animation. |
| Inline error / error summary | Explain what failed, its effect, what was retained and a next action. Link summary entries to fields. Unknown errors get honest generic guidance plus optional technical details. |
| Banner | Persistent cross-field/system issue, concise impact and next action. Only global blockers belong in shell; module failures remain near affected work. Do not blanket-dismiss an unresolved failure. |
| Toast / notification | Success ~5s, dismissible; error/actionable warning stays until dismissed or resolved. At most three visible, group repeated poll errors, accessible live announcement. Persistent issue also lives inline. |
| Transcript / composer | Customer incoming left; AI and human outgoing right, labels distinguish the actual sender. System/capture event row sits outside message bubbles. Text wraps; sending/failure is explicit; manual send retains draft on known failure. |
| Progress | Distinguish processing progress from successful delivery. Text equivalents for all counts; finite progress only with a real denominator. No fabricated AI-thinking progress. |

**Accessible foundations:** begin with native form elements and improve the existing components. Use an accessible headless primitive for complex overlays/menu/combobox behavior rather than reproducing it in every page. [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) is a candidate to evaluate in Phase 2; it is not installed or mandated here. Native `<dialog>` is also viable if the full contract is verified. Ordinary selects do not need replacing merely for visual novelty.

Route tabs must remain normal links. For actual tab widgets, follow the [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), including arrow navigation and selected/controlled relationships. For modal interactions, follow the [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), including focus containment and restoration.

## Responsive contract

| Viewport | Shell | Inbox | Forms, tables and overlays |
| --- | --- | --- | --- |
| 320–767px | 56px header with menu, current destination and compact status; navigation in a full-height drawer | One view at a time: list → transcript; Back restores list position and filters. Contact info via full-screen drawer. Composer above keyboard/safe area. | Single column; 16px inset; 44px touch targets; 16px input text. Key-field stacked records for Contacts/Campaigns. Essential tables may have a labeled contained scroll region. |
| 768–1023px | Header + navigation drawer to preserve content width | List width about 280px plus flexible transcript where both fit; otherwise one-pane mode | Single-column form or label/control grid when content fits; drawers max 560px |
| 1024–1279px | 232px visible navigation | About 288px conversation list + flexible transcript; contact context overlays | Full-width operational lists, forms max 760px |
| ≥1280px | Same navigation, no gratuitous widening | 320px list + transcript; optional 288px contact rail only when transcript retains ≥440px | Use remaining space for information, not extra metric cards |

Use actual available container width to decide whether a third pane fits. `minmax(0,1fr)`, `min-width:0`, logical properties and `100dvh` prevent current overflow. Sticky regions must not obscure keyboard focus; long headers/actions wrap. Date and field rows stack before labels collide. Table horizontal overflow must never widen the whole document. A 320px viewport and 400% zoom must preserve access to core actions, with limited exceptions for genuinely two-dimensional content.

QR pairing uses the existing QR mechanism. On a phone, explain that the code must be displayed on another screen; do not invent same-device or phone-code pairing. Preserve the connection drawer context and provide clear instructions for continuing on desktop.

## Empty, failure and recovery examples

These are proposed strings tied to specific states; they are not already present in the app.

| Surface / condition | Title and explanation | Action |
| --- | --- | --- |
| Overview / no setup | **Set up your first AI reply.** Create a bot and connect your business number. | Create AI bot |
| Inbox / no connected channel | **Connect a number to receive conversations.** Incoming messages will appear here after setup. | Connect number |
| Inbox / connected, no conversations | **Ready for your first conversation.** Send a message to your connected business number from another WhatsApp account. | View connected number |
| Inbox / empty Open filter | **No open conversations.** Resolved conversations are still available. | View resolved |
| Inbox / no selection | **Choose a conversation.** Read the messages and check who will reply. | No redundant button; keyboard focus remains in list |
| Search / no matches | **No matching contacts.** Try another name or number, or clear your filters. | Clear filters |
| Bots / first use | **Create an AI bot for your customers.** Set its instructions and choose the tools it can use. | Create AI bot |
| Tools / first use | **Save customer details to a sheet.** Start with a sales enquiry or support request. | Create tool |
| Captures / no results | **No details collected yet.** Captures appear when an attached bot uses this tool. | Review bot attachment |
| Capture / write failed | **Details saved here. Sheet sync failed.** Review the connection and try again. | Review sheet setup / Retry sync |
| Capture / not submitted | **Sheet setup needs attention.** These details are saved here; nothing was sent to Google Sheets. | Review sheet setup |
| Contacts / first use | **Your customers will appear here.** Contacts are added when you receive WhatsApp messages. | View WhatsApp channels |
| Campaigns / first use | **No campaigns yet.** Create a draft message for a group of customers. | Create campaign |
| Module request failure | **Could not load conversations.** Try again. Your saved conversations have not been changed. | Retry |
| Refresh failure | **Updates paused.** Showing the last successfully loaded data. | Retry |
| Global AI paused | **AI replies are paused.** You can still receive messages and reply manually. | Review reply settings |
| Form save failed | **Changes were not saved.** Your edits are still here. Try again. | Save changes |
| Session expired | **Sign in to continue.** Return to this page after signing in. | Sign in; preserve only safe return URL/context |
| Login network failure | **Could not sign in.** Check your connection and try again. | Sign in, enabled again |

Do not claim stored data is unaffected if the response indicates a partial mutation. For multi-request operations show each completed and failed step. For ambiguous send timeouts, explain that status needs checking before another send; a retry may duplicate delivery without server idempotency.

## Motion and accessibility release criteria

Motion: 120ms controls, 160ms popovers, 200ms drawers/dialogs, 150ms exits; ease-out `cubic-bezier(0.2,0.8,0.2,1)`. Animate opacity/transform only. No delay when changing conversation or typing. Reduced motion removes translation/scale and skeleton pulse; status still updates.

Target [WCAG 2.2 AA](https://www.w3.org/WAI/WCAG22/quickref/): readable contrast, visible unobscured focus, keyboard operation, semantic landmarks, associated labels, non-color states and accessible status feedback. Verify with keyboard and VoiceOver, not just automated scans. Pause repeated live announcements during polling; announce a changed result once, without moving focus or reading the whole transcript again.

Use 44px touch targets as the product standard. Keep password-manager/paste support. Respect IME composition so Enter while composing text cannot accidentally send. Add skip navigation, accessible page titles, form error focus, focus restoration from overlays, and scroll-position preservation. No ARIA attribute compensates for an incorrect native control.

## Adoption and review

Before each migrated component record its user task, focal hierarchy, semantic palette, depth/surface role, type role and spacing. The component's examples must show all relevant states and one phone layout. Review token use, visible hierarchy, reply-status consistency and accessibility before expanding to the next module.

On adoption in Phase 2, promote this contract into `.interface-design/system.md` or make that file a concise pointer to this canonical specification. Do not maintain two diverging full token documents. Future changes update the shared contract first and explain any intentional exception.
