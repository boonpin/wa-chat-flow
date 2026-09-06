# Information architecture and product workflows

Proposed system-wide destination structure. Implementation remains phased.

## Navigation

```text
WA Robot

WORK
  Overview
  Inbox
  Contacts

AUTOMATION                       expanded group; not another landing page
  AI bots
  Tools
  Reply settings
  Campaigns

WHATSAPP
  WhatsApp channels

UTILITY
  Activity
  Settings
  Help

  Connection summary             status link, not a master toggle
  Account / Sign out
```

Three daily destinations lead. Automation children are visible by default on desktop and link directly to their work; no additional click is required to open a bot or capture list. “Automation” groups the existing capabilities without promising a visual workflow builder. WhatsApp channels stays visible because repairing a connection can be urgent. Activity is a diagnostic utility, rather than another inbox.

Keep the brand compact. Do not add a workspace switcher or teammate avatar stack: tenancy and team assignment are not current product capabilities. The account menu initially contains Sign out and access help; display an account name only if the authenticated user API supports it.

Use **WhatsApp channels** as the consistent module title, with the explanatory line **“Connect the WhatsApp numbers your business uses.”** A channel is a connected number in WA Robot. It is unrelated to WhatsApp's public broadcast Channels. Use **Connect number** for the action. Avoid switching between Account, Via, Session and Channel across screens.

## Route and capability migration

Keep current URLs while the shell changes. Migrate a destination when its phase ships, preserving old bookmarks and redirecting to canonical routes with query state intact. Never create two independent editors for one setting.

| Current route / capability | Proposed destination | Proposed canonical URL | Phase |
| --- | --- | --- | --- |
| `/`, `/dashboard` | Overview | `/dashboard` (root still redirects here) | 3 |
| `/login` | Sign in | `/login` | 2 |
| `/inbox` | Inbox | `/inbox?status=open`; selected thread `/inbox/[id]` with query context | 4 |
| Contacts chat drawer | Contact history within Inbox | `/inbox?contactId=[id]` and conversation links | 4/7; history API gap documented |
| `/bots` | Automation → AI bots | `/bots`, `/bots/new`, `/bots/[id]` | 5 |
| `/tools`, captures local tab | Automation → Tools | `/tools?view=tools`, `/tools?view=captures`, `/tools/new`, `/tools/[id]` | 6 |
| `/contacts` | Contacts | `/contacts`, `/contacts/[id]` as profile/drawer context | 7 |
| `/settings` automation controls | Automation → Reply settings | `/automation/replies` | 8 |
| `/blast` | Automation → Campaigns | `/campaigns` | 8 |
| `/blast/create`, `/blast/[id]` | Campaign creation/detail | `/campaigns/new`, `/campaigns/[id]` | 8 |
| `/wa` | WhatsApp channels | `/channels/whatsapp`, selected channel in query/drawer | 9 |
| `/logs` | Activity | `/activity`, event detail in `?event=[id]` | 10 |
| No general settings hub | Settings | `/settings`; access/help subsection `/settings/access` | 10 |
| Docs only | Help | `/help` with task-oriented articles | Shell link first; consolidate in 10 |

**Special case `/settings`:** it is a current bookmark for automation policy. Phase 8 can temporarily redirect it to `/automation/replies`; when Phase 10 introduces the hub, keep **Reply settings** as the first prominent shortcut and mark its new location. `/settings#auto-reply` and any introduced legacy aliases should resolve to Reply settings. A full redirect and a settings hub cannot occupy the same URL simultaneously.

**API routes keep their current names**, including `/api/blast/...` and `/api/wa/...`. Changing user language does not require renaming backend endpoints or transport types.

Deep-linked records need their own load/error/not-found state, independent of current list membership. Back returns to preserved filters, scroll and selection. Page titles describe both the module and selected record. URL values contain IDs and filters, never credentials or message drafts.

## Page composition and primary task

| Page | Focal task | Proposed composition |
| --- | --- | --- |
| Sign in | Access the workspace | Compact 400px form, visible labels, password reveal, pending and recoverable failure; “Need access? Contact your administrator.” No fake password-reset workflow. |
| Overview | Decide what needs attention | First-run checklist when incomplete; otherwise actionable known issues first, recent open conversation work next, compact configuration summary last. No decorative chart grid. |
| Inbox | Read and respond | Queue/list + transcript; optional contact context drawer. Header separates conversation lifecycle, reply mode, bot and channel. Composer stays anchored within the conversation region. |
| AI bots | Describe the bot's behavior | Scanable list with Name, availability, default usage and tools. Full-page editor: Instructions, Tools, AI connection; purpose/instructions lead. |
| Tools | Collect and recover customer details | Tools/Captures route tabs. One Create tool action with templates. Guided setup; capture detail focuses on retained data, sync outcome and next action. |
| Contacts | Find a customer and manage defaults | Search/filter/table → profile. Identity and phone together; default reply mode/bot, related conversation/history, channel context. Bulk changes have explicit scope. |
| Reply settings | Control global AI permission and fallback | Current saved policy strip → small grouped form → impact summary → Save/Discard. Explain overrides only where they matter. |
| Campaigns | Send a deliberate customer update | List → draft setup → review → send confirmation → progress and recipient outcomes. Preserve existing pause/resume/cancel behavior. |
| WhatsApp channels | Connect or repair a number | Named connection rows, individual reported state and actionable recovery; connect drawer carries name → QR → connection result. |
| Activity | Explain what happened | Paginated event table; event details show outcome, customer, message/capture and recovery first; IDs/payload diagnostics under disclosure. |
| Settings | Find system configuration and access help | Concise navigation hub to each configuration owner; access help and runtime limits. Add editable preferences only where persistence is supported. |

## Settings ownership

| Setting | Owner | Contextual access | Save behavior and scope |
| --- | --- | --- | --- |
| Global permission for AI replies | Automation → Reply settings | Overview/Inbox status links | Save explicit draft; affects future AI reply decisions across all channels. It does not stop manual replies or campaign sending. |
| Fallback/default bot | Same Reply settings form | Bot list “Make default” shortcut with clear impact | Use existing setters; display legacy fallback discrepancies instead of silently changing them. |
| Bot name/instructions/provider/model/key/enabled | AI bot editor | Bot links from Inbox/default summary | Explicit save. Store blank key as “keep existing”; credentials never redisplayed. |
| Tool definition/fields/Google write connection | Tool editor | Capture recovery link; bot Tools tab | Explicit save. Preserve machine keys and column mappings; do not promise renamed labels are harmless. |
| Bot-to-tool attachment | Bot Tools tab; tool setup may offer a shortcut | Tool setup review | Existing bot PUT replaces the tool-ID set. Read latest assignments and preserve unrelated ones. If second save fails, keep created tool and show “Tool saved; bot attachment needs retry.” |
| Current conversation reply mode and bot | Inbox | Contact's “Open conversation” action | Immediate acknowledged operation. Existing API also changes this customer's defaults for future conversations. Explain this. |
| Contact AI enabled | Contact profile / deliberate bulk action | Inbox context | Existing API updates the open conversation's mode and future default. Do not label it future-only. |
| Contact default bot | Contact profile | Current routing explanation | Existing API changes contact default; an existing conversation override can continue using another bot. Show the distinction. |
| Channel name and lifecycle | WhatsApp channels | Global health and conversation channel link | Rename saves inline; connect/disconnect/remove are explicit operations. |
| Sending delay and channel | Campaign draft | Campaign review | Preserve current draft creation payload and send engine; no implied global policy. |
| Administrator credentials, provider fallback keys, gateway configuration | Administrator setup reference | Settings → Access and setup help | Current backend has no configuration API for these. No fake inputs or inferred key validity. |

Settings remains useful without becoming a dumping ground: it explains where configuration lives and the scope of each setting. Do not add empty Team, Billing, API, Security or Integration categories merely to resemble another SaaS product.

## State model: mode is not readiness

The signature pattern is a compact **reply status line**. It appears in five concrete places: shell health summary, Overview attention rows, Inbox thread header, contact profile routing summary, and bot/default setup review.

Example with current API data:

```text
Sales · Reported connected     Reply mode: AI     Bot: Sales assistant
AI replies are paused globally. You can still reply manually.  [Review reply settings]
```

Example in human mode:

```text
Sales · Reported connected     Reply mode: Human
AI will not answer new messages for this customer.             [Use AI replies]
```

Do not imply that a particular teammate has taken ownership. The data stores `human`, not a human assignee.

| Dimension | States | Display rule |
| --- | --- | --- |
| Channel connection | Offline, Starting, Scan QR code, Connected, Failed; frontend Unknown on request failure | Show the named channel. Until live/cache provenance exists, “Reported connected” is more truthful than a live guarantee. |
| Global AI permission | Enabled / Paused | This gates AI only. Explain why an AI-mode thread may not receive an automatic reply. |
| Conversation mode | AI replies / Human replies | Independent of Open/Resolved and channel state. Explain that changing mode also affects this customer's future conversations. |
| Conversation lifecycle | Open / Resolved | Resolve closes the thread. A new incoming message creates a new thread with contact defaults. Manual outgoing activity can reopen a resolved thread under existing behavior. |
| Bot | Configured / Disabled / No eligible bot; fallback source | Match existing selection precedence. Credential presence does not prove the key/model works. |
| Message | Received / Sending / Sent / Failed | Sent does not mean delivered or read. Show retry guidance without inventing a resend endpoint or idempotency guarantee. |
| Capture | Pending / Synced / Failed / Not submitted | “Saved here” and “Synced to Google Sheets” are different facts. Failed or unconfigured sync does not mean the lead was lost. |
| Data freshness | Loading / Loaded / Refresh failed / Unknown | Track the frontend's last successful fetch separately from the server's connection verification; never equate them. |

**Current routing order:** global permission → conversation mode → supported text → eligible bot selected in conversation/contact/settings/default-flag order → AI/tool work → send. Display all known blockers, with the most actionable one first. This is a presentation of existing behavior, not a rewrite of selection logic. Stale snapshots and in-flight AI work remain possible: “Use human replies” is not a guarantee that an already generating reply is cancelled.

Do not show “AI is typing,” “All systems operational,” delivery/read ticks, response-time metrics, SLA breaches or saved backend drafts unless supporting state exists.

## Workflow contracts

### First-time setup

Overview checklist: **Create an AI bot → Connect a WhatsApp number → Enable AI replies → Verify a conversation.** Default selection is offered within bot setup. The checklist permits completing dependencies in a different order and always resumes at saved state. Verification means the operator observes an actual incoming text and response; it is not a simulated test button.

Explain that new contacts arriving while global AI is paused inherit a human default. Enabling the global switch later does not automatically flip those existing contacts. Link to the relevant contact action. Successful setup does not turn all existing conversations into AI mode.

### Inbox and customer history

Default list is Open. Add a reply-mode filter (All / AI replies / Human replies), search and a channel filter where data supports them. These are filters, not unread/assigned queues. Scope client-only filtering to loaded results; do not claim account-wide counts from a capped list.

Conversation selection lives in the URL, independent of filtering. Preserve each draft in memory while switching threads; disclose that refresh can clear drafts until deliberate draft persistence is added. Confirm leaving a page with unsent text if it would be lost. Resolve does not silently discard it.

Use **Use human replies** / **Use AI replies** instead of an ambiguous toggle. Show a pending operation then the acknowledged mode. Keep manual replies available while AI mode is on with a compact explanation and adjacent takeover action; do not silently disable AI just because the operator typed.

Contacts opens a profile with **Open conversation** and **View history**. Preserve access to historical messages when consolidating the old drawer; full contact-history filtering and older-thread pagination require the read-API work listed in the plan. Use one shared renderer in the interim if archive navigation cannot yet be complete.

### Bot setup

Choose a purpose/template, edit **Bot instructions**, then choose provider/model/key in an **AI connection** section. A key is still a required dependency if no server fallback is configured; progressive disclosure must not conceal it. Template replacement asks to replace existing instructions. Provide an editable model ID with appropriate provider guidance so stored/custom values do not disappear from a hardcoded selector; model compatibility is not inferred from visual appearance.

Saving enabled/default changes has an explicit impact summary. No test-chat, knowledge-base upload or external-agent toggle is shipped without supporting APIs.

### Tool setup and recovery

Create tool opens purpose templates, then fields, sheet connection, bot attachment and review. This is one page with navigable sections; use step-by-step disclosure only for the external sheet setup. Keep typed data when moving between sections.

Present field labels first and generate valid machine keys for new fields with validation and an advanced editing affordance. Existing keys stay unchanged unless the user explicitly edits them. A friendly display name can be derived from a machine name, but an independently persistent display-name field requires a schema addition and is deferred.

The Google connection guide provides the actual script text/download, secret setup, deployment steps and `/exec` validation. Do not label this OAuth or invent a “Connect Google” button. Saved credentials mean **Setup saved**, not **Connection tested**. A genuine sync verifies the integration.

Capture detail prioritizes what is safely stored. For `not_submitted`, action is **Review sheet setup**, then **Retry sync**. For known failed writes, show the returned reason and retry when appropriate. Pending is neutral progress; identify a stalled write only from evidence, not from the string alone. Disable repeated requests while a retry is in flight.

### Campaigns

Creation leads with sender, message and recipients; delay remains in Sending options with current meaning/defaults. Review shows selected channel, recipient count, named/sample preview and sending behavior. **Save draft** accurately describes creation; **Send campaign** confirms a subsequent actual send. Pause is reversible; cancellation explains that unsent recipients will be skipped and sent messages cannot be recalled.

Completion is **processing complete**, not proof every recipient received a message. Show sent/failed/skipped separately when known. Errors route to the named channel or recipient detail. Never tell users to resume a failed campaign from a paused state unless that transition is available.

### Settings

Each form has a saved-state summary, clear field scope, local dirty state, inline validation and a consistent footer. Defaults and operational status use saved server values; draft changes are marked **Unsaved**. Save is acknowledged before success; navigation during dirty state offers **Keep editing** or **Discard changes**.

Maintain a clear distinction between Save changes, live operations, and destructive actions. The Settings hub links to configuration rather than replicating all forms.
