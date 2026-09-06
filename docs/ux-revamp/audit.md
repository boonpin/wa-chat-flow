# Product UX audit

Phase 1 · 6 September 2026 · Proposed recommendations; no application changes.

## 1. Product lens

**Primary human:** an SME owner or customer-service operator who checks enquiries between other business tasks, handles exceptions personally and wants dependable automation without learning model infrastructure. This persona is inferred from the brief; frequency and task-time assumptions need customer validation.

**Primary jobs:** find a conversation, understand whether AI or a person should reply, send the right response, record an enquiry, and recover a disconnected number or failed sheet sync. Setup is occasional; responding and checking health are recurring.

**Intended feeling:** a well-run service desk: composed, readable and efficient. Clear state earns trust; restrained visuals help daily scanning.

Severity: **P1** can mislead an operator, block core work, lose unsaved work or exclude users; **P2** increases recurring effort or confusion; **P3** is lower-impact polish. There is no unsupported P0 outage claim.

## 2. Inspection coverage

All application UI sources were read in full, rather than sampling only the sidebar and Dashboard. API/service files were inspected read-only where needed to verify the meaning of controls and data.

| Surface / route | Source | Inspected patterns |
| --- | --- | --- |
| Root `/` | `app/page.tsx` | Redirect to `/dashboard` |
| Root layout / styles | `app/layout.tsx`, `app/globals.css` | Metadata, language, Geist fonts, tokens, global form styles, motion and responsive rules |
| Login `/login` | `app/login/page.tsx` | Credentials, validation, pending/error behavior, mobile card |
| Authenticated shell | `app/(dashboard)/layout.tsx` | Nine flat links, active matching, fixed sidebar, sign-out, ToastProvider |
| Overview `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Four data requests, health aggregation, metrics, alerts, skeletons |
| Inbox `/inbox` | `app/(dashboard)/inbox/page.tsx` | Search, filters, selection, polling, transcript, reply mode, bot routing, resolve/reopen, composer |
| Bots `/bots` | `app/(dashboard)/bots/page.tsx` | List/editor, templates, provider/model/key, prompt, enabled/default, tool assignment, save/delete |
| Tools `/tools` | `app/(dashboard)/tools/page.tsx` | Templates, field builder, Apps Script setup, credentials, captures, retries |
| Contacts `/contacts` | `app/(dashboard)/contacts/page.tsx` | Search, AI/channel filters, selection, bulk actions, inline controls, separate chat drawer |
| Campaigns `/blast` | `app/(dashboard)/blast/page.tsx` | List, progress, actions, polling, empty/loading |
| Create campaign `/blast/create` | `app/(dashboard)/blast/create/page.tsx` | Channel, delay, template, sample preview, contact/manual audience, validation |
| Campaign detail `/blast/[id]` | `app/(dashboard)/blast/[id]/page.tsx` | Lifecycle controls, warnings, metrics, recipient pagination and errors |
| WhatsApp `/wa` | `app/(dashboard)/wa/page.tsx` | Add/name/connect/scan/disconnect/remove, polling, QR, state copy |
| Settings `/settings` | `app/(dashboard)/settings/page.tsx` | Global toggle, default bot, explanations, dirty/save/discard |
| Logs `/logs` | `app/(dashboard)/logs/page.tsx` | Paginated feed, keyboard rows, event drawer, payload details, retry |
| Shared UI | `components/ui/index.tsx` | Card, Button, Badge, Toggle, Input, Textarea, Select, Skeleton, ToastProvider/useToast, EmptyState, SectionHeader, StatusItem |
| Assets and configuration | `public/*.svg`, `app/favicon.ico`, package/build configuration | Starter SVG assets, existing dependency budget, no installed headless UI/component library |
| Guide | All 14 `docs/*.md` documents plus root README | Setup, login, health, connection, bots, contacts, automation, workflow, troubleshooting, Inbox, captures and architecture |
| Existing screenshots | All six `docs/screenshots/*.png` | Desktop only, old navigation, empty/loading states and obsolete connection/login details |

No separate frontend package, route-level `loading.tsx`, `error.tsx` or custom `not-found.tsx` exists. The requested “Automation” module is currently the **Automation Settings** page at `/settings`; there is no `/automation` route or rule builder.

Read-only behavioral evidence includes authentication/proxy, conversation list/detail/mutations, contact updates, bot serialization and defaults, tool invocation responses, message history, campaign lifecycle, `lib/messaging/bot-selection.ts`, `incoming-handler.ts`, and `lib/wa/sessions.ts`.

## 3. Findings across the ten requested audit categories

### Information architecture

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| IA1 | P1 | Contacts contains a second composer/transcript (`ChatWindow`, line 58), separate from Inbox. It discards sender/status/error fields available from `/api/wa/chat` and expects `chat` instead of current `text` at line 181. Ordinary text becomes `[text]`; AI/human identity disappears. | One transcript/composer in Inbox; Contacts owns customer identity, defaults and links to history. |
| IA2 | P2 | “Settings” contains only global automation settings; Bots also sets the default. No Automation destination exists. | Group automation configuration under an expanded Automation navigation group with explicit Reply settings. |
| IA3 | P2 | Captures live under Tools while richer event details live under Logs, without direct links to the relevant conversation or configuration. | Keep capture work with Tools; use one event-detail pattern and contextual links to Inbox and the tool. |
| IA4 | P2 | Blast and Logs are real routes absent from the requested phase names. Removing them in a visual redesign would lose capabilities. | Retain Campaigns under Automation and Activity as a utility. Cover them in Phases 8 and 10. |

### Navigation

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| N1 | P2 | Nine flat `NAV_ITEMS`; WhatsApp setup precedes Inbox; occasional and daily tasks receive equal weight. | Put Overview, Inbox and Contacts first; group automation children; keep health and utility links visible. |
| N2 | P1 | Inbox selection is local state and depends on `conversations.find(...)` at line 415. When Resolve removes the row from Open, or a filter excludes it, the thread unmounts and the draft is lost. The comment claims the opposite. | URL-selected conversation independent of list membership; preserve drafts by conversation ID and show “Outside current filter.” |
| N3 | P2 | Bot/tool editor selection, captures tab and most filters are local state. Reload/back/deep links lose context. “Manage tools” is a plain anchor during bot editing. | Stable detail URLs and query-string view state; guarded exits from dirty forms. |
| N4 | P2 | No help entry, skip link, global health context, mobile navigation, or `aria-current` in the shell. | Shared shell with labeled navigation, help, current-location semantics and a health summary linking to repair. |

### Inconsistent interaction patterns

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| P1 | P1 | Bots uses list/editor, Tools replaces the list, Contacts and Logs hand-roll drawers, deletes use browser `confirm`. Only Logs implements Escape; neither drawer implements a complete modal contract. | Full pages for complex configuration, drawers for inspection, dialogs for consequential confirmation. Reuse accessible primitives. |
| P2 | P1 | Global settings require Save; contact/conversation toggles mutate immediately; bot toggles are drafts. Settings badges say “Active” and “AI is currently replying” before Save. | Explicit draft status for configuration; immediate operational actions show pending and acknowledged result. Never style a draft as live. |
| P3 | P2 | Headers vary (`p-8`, `p-6`, 18/20px); forms and tables repeat raw styles despite shared components. Tabs use green pills, dark segments and underlines without common semantics. | Shared page types, tokenized controls, route tabs versus filter segments, common table toolbar/pagination. |
| P4 | P2 | Green signifies navigation, AI, human messages, channels, success and progress; contact channel colors are hashes. Badge `size` is accepted but unused. | Semantic status variants; channel identity uses a neutral icon/name; AI blue and human neutral, both explicitly labeled. |

### Unclear terminology

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| T1 | P2 | WhatsApp / Numbers / Account / Session / Via refer to the same underlying connection. “Blast,” “IN,” “SYS,” “System Prompt,” and machine tool names require interpretation. | Consistent channel terminology, Campaigns, Customer/System labels, Bot instructions, friendly display labels with technical names secondary. |
| T2 | P1 | “System default” in Inbox suggests one source, but routing is conversation → contact → settings default → flagged default, skipping disabled bots. Settings “None” can still fall back to a flagged default. | Show the selected/effective bot and fallback source. Explain legacy fallback if present; do not claim “no bot will reply” from a null settings ID alone. |
| T3 | P2 | Every outgoing Inbox preview says “You,” even AI/system output. The list response has direction but no sender type. | Remove the misleading prefix now; add sender labels only when supported by data. Use “Human replies” for mode, not an invented assigned teammate. |

### Too many steps and avoidable rework

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| F1 | P2 | First-time checklist spreads bot creation, default selection, activation and connection across multiple screens; end-to-end guide recommends a different order. | One dependency checklist on Overview with deep links and resumable progress derived from saved state. |
| F2 | P1 | Sheet setup requires leaving the app, locating a source file, deploying Apps Script, copying credentials, creating the tool, then finding the bot editor to attach it. In-app setup is only a file-path paragraph. | Template → collect fields → guided sheet setup → attach bot/review. Show accurate saved/setup-needed states. Preserve the existing Apps Script mechanism. |
| F3 | P2 | Contacts “Default” bulk option uses the same empty value as “Choose...” and is ignored by the change handler (around line 511). Selection persists through filters and select-all compares only counts. | Explicit apply action, distinct default sentinel, scope-aware select-all, and partial-failure results. |
| F4 | P2 | Add Number saves a disconnected record, then requires a separate Connect action with no continuation. | “Add and connect” sequence using existing requests, preserving the saved record with Retry if connection fails. |

### Poor hierarchy

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| H1 | P2 | Overview leads with total contacts/bots and duplicates connection state. Daily conversation work is absent. Health is fetched once, and any connected number gives a green aggregate. | Put known blockers and conversation work first; show per-channel coverage, bot names and data freshness limitations. |
| H2 | P2 | Bot editor leads with provider/key/model before behavior; tool editor leads with machine name; three creation buttons compete in Tools. | Start with purpose/instructions and one primary creation action with templates inside the flow. Keep required technical setup clearly available. |
| H3 | P2 | Campaign progress colors sent plus failed as green; cancelled recipients can appear “Pending” because the UI computes total − sent − failed although backend marks them skipped. | Separate processed from delivered, and cancelled/skipped from waiting. Use accurate labels even when aggregate data is limited. |

### Settings grouping and ownership

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| S1 | P1 | Default configuration spans `systemSettings.defaultBotId` and `aiBots.isDefault`. Clearing one does not necessarily clear the other. The current frontend treats them as equivalent. | One primary editor and a routing explanation. Surface conflicts; any normalization is an explicit backend behavior change, not a silent frontend cleanup. |
| S2 | P1 | Contact AI mode updates the open conversation; contact bot assignment does **not** update its bot override. Inbox bot/mode changes also update the contact default. | Explain scope next to controls. Label contact bot as a default for future conversations; show current conversation override separately. |
| S3 | P2 | Access/reset and system troubleshooting are shell commands in guides; the product has no account/settings API beyond two automation fields. | Settings navigation hub plus access/setup help. Do not build pretend Team/Billing/Security forms. |

### Missing or misleading feedback/status/error states

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| E1 | P1 | `MessageBubble` renders **all** system rows as red `message.error || 'Something went wrong'` (Inbox line 132). Successful capture rows are system messages with `status: sent` and no error. | Render system events by type and result; show “Details saved to Google Sheets” only for supported successful sync, and preserve capture versus submission distinction. |
| E2 | P1 | WhatsApp line 225 says “Auto replies active” solely from connection state. Global AI, bot availability and conversation mode are not checked. Overview's “Everything looks good” has similarly limited evidence. | Treat channel connection and AI readiness independently; replace blanket health claims with specific verified or reported facts. |
| E3 | P1 | Contacts updates, bot deletion, channel rename/disconnect/delete do not check HTTP success before local success feedback. Bulk updates announce every row successful even after failures. | Acknowledged server response, per-item pending, partial success summary, retry failed items without clearing valid data. |
| E4 | P1 | Login has no catch/finally; a rejected fetch leaves Sign In pending. Many list loads swallow failed responses into empty arrays or have uncaught errors. Bots/Tools/Contacts initialize to empty without loading. | Separate initial loading, empty, failed, refreshing/stale and unauthorized. Retain last good data with persistent recovery guidance. |
| E5 | P1 | `getLiveStatus` returns stored status on provider failure; API does not expose whether it was live. A successful HTTP poll may carry stale “connected.” | Describe reported status honestly; request additive health provenance before claiming live gateway health. |
| E6 | P1 | All toasts disappear after 3.5s, without live regions, close/action controls or a stack limit. Important errors have no durable recovery location. | Accessible notifications, persistent actionable errors, inline save/field errors and region-level retry. |
| E7 | P2 | Captures loads latest 100, with a maximum of 500; UI count looks exhaustive. Pending is counted as failed/unsynced and retry is offered even during pending. Inbox limits to 100 conversations / 200 messages with no older-history controls. | Scope labels and fetch states now; explicit pagination gaps before promising a complete operational archive. Pending alone does not prove a stalled job. |
| E8 | P1 | Dirty bot/tool/settings edits are lost on route, selection or template replacement. Bot required fields sit outside a submitted form, so native required validation does not run on Save. | Shared dirty-form guard, real form semantics, linked field errors, safe template replacement and in-memory draft retention. |

### Responsive and accessibility issues

| ID | Severity | Evidence and consequence | Recommendation |
| --- | --- | --- | --- |
| R1 | P1 | Fixed 224px shell with `ml-56`; Inbox adds a fixed 320px list and 64px horizontal page padding. No viewport breakpoint rules exist in application UI. | Mobile navigation drawer and a one-pane Inbox; use `minmax(0,1fr)` and content-aware breakpoints. |
| R2 | P1 | Bots uses an unconditional five-column split, Tools two-column forms and a 12-column field editor, Dashboard three metrics, campaign detail four metrics; Contacts/campaign tables lack contained overflow. | Full-page mobile editors; stacked field groups; responsive key-field rows; contained scrolling only for intrinsically tabular data. |
| R3 | P1 | Shared labels do not use `htmlFor`/associated IDs. Switches lack accessible names and do not forward native disabled semantics; Contacts rows are mouse-only. Login inputs lack autocomplete metadata. | Repair shared field/switch contracts, keyboard-accessible row links, password-manager metadata and visible focus. |
| R4 | P1 | Existing white-on-`#16A34A` button text is **3.30:1**, and `#94A3B8` on white is **2.56:1**. These occur on ordinary small UI text. | Proposed primary contrast is 5.00:1; tertiary text is at least 4.87:1 on the canvas. Test real component states. |
| R5 | P2 | Controls reach 10–12px text; close icons are tiny; rename and “Fix” affordances are hover-dependent. No reduced-motion policy; fixed save/toast bars ignore narrow viewports. | Larger touch targets, visible/focus-visible actions, readable metadata, reduced motion and safe-area-aware feedback. |

### Opportunities to simplify the product

1. **One conversation workspace.** Remove duplicated chat behavior while preserving all-history access; provide one way to send, identify the sender, handle AI mode and recover failure.
2. **One owner per setting.** Contextual shortcuts lead to the owner; they do not create divergent drafts or contradictory controls.
3. **One status vocabulary.** Connection, reply mode, AI permission, bot availability, lifecycle and delivery are independent dimensions.
4. **One primary action per task region.** New bot/tool/campaign opens an intentional flow; templates belong inside it; delete belongs in a secondary action menu and confirmation.
5. **One recovery pattern.** Clear impact, retained data and a useful next action; detailed technical errors remain available on demand.
6. **One setup checklist.** Progress comes from saved configuration. A completed connection step does not claim a successful AI reply or Google write.

## 4. Workflow friction: current versus proposed

These are source-based step counts, not measured completion times. External Google and WhatsApp actions still exist.

| Job | Current path | Proposed path | What actually improves |
| --- | --- | --- | --- |
| Start using AI | Bot editor → save → Settings/default → save → WhatsApp/add → connect → scan → Inbox | Overview checklist → create bot and choose default → connect channel → explicit enable AI → verify with an incoming message | One place to resume; no need to remember dependencies or revisit default selection |
| Take over a customer | Find Inbox → select → toggle AI off → read toast → type/send | Select conversation → “Use human replies” → acknowledged mode → send | Similar click count; clear impact and persistence across this customer's future threads |
| Fix a lost lead sync | Tools/Captures → read raw failure → find tool → edit credentials → return to captures → retry | Capture detail → “Review sheet setup” with return context → save → “Retry sync” | Keeps the failed capture and original data in context |
| Capture a sales enquiry | Template → long technical form → external script work → save → Bots → select → attach tool → save | Guided tool setup with bot attachment and review | Eliminates bot-search detour; external setup remains honestly represented |
| Read a customer's history | Contacts → incompatible secondary chat UI | Contact profile → conversation/history in Inbox | One reliable message rendering system; full archive remains a pagination dependency |
| Send a campaign | Long form → create → detail → Start immediately | Message/audience setup → review sender, recipients and preview → save draft → explicit send confirmation | Keeps necessary review while reducing uncertainty and accidental sends |

## 5. Documentation and screenshot drift

- All six existing images were opened. They are 1280×720 desktop captures, with a five-item sidebar rather than today's nine. No Inbox, Tools, Campaigns, Activity or phone screenshots exist.
- Dashboard and Settings screenshots stop at skeleton loading. They cannot demonstrate successful states.
- Login screenshot advertises default credentials; current code and access guide deliberately do not provide defaults. Treat the image as historical, not an instruction.
- WhatsApp screenshot shows an older single-connection flow; current UI has multiple named numbers.
- `docs/01-getting-started.md` omits Tools from its module list; the guide index has Tools but no dedicated Campaigns or Activity chapters.
- `docs/08-end-to-end-workflow.md` omits conversation-mode and conversation-bot routing. It differs from `docs/07-automation-settings.md` and current services.
- The short sheet-setup document omits shared-secret configuration explained in the full guide. The full guide's claim that column labels can change freely requires correction: the script maps incoming values against existing headers and does not always rewrite renamed headers.
- Guide examples mix operational instructions with developer deployment details. Separate SME task help from administrator reference, with links between them.

During each implementation phase update that module's guide and capture successful, empty, failure and responsive states using synthetic content. Do not overwrite old screenshots during this audit.

## 6. What to retain

Preserve named multi-number connections, explicit human/AI message attribution in Inbox, captured-data retention before sheet sync, retryability of captures, secret write-only handling, default bot fallback behavior, Open/Resolved conversations, campaign draft/start separation, and Logs' deliberate pause of live refresh away from page 1.

The existing shared UI module is a migration starting point. Fix and split it incrementally rather than building a competing second component library.

## 7. Evidence limits and standards

Browser fixtures validate rendering and frontend reaction, not production gateway reliability or backend transaction correctness. No live AI, sheet-write, QR scan, real send, screen-reader user study or large-account performance test was performed. Browser evidence and measurements are indexed in [evidence](./evidence/README.md).

Accessibility recommendations target keyboard access, names/labels, visible focus, text contrast, reflow and non-color state cues under [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/). The contrast figures above are calculated from source colors. The proposed 44px touch target is our product target; WCAG 2.2 AA's target-size minimum is 24 CSS pixels with exceptions.
