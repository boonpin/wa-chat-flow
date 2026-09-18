# UI/UX enhancement plan — 16 September 2026

Status: Implemented in the working tree, with the multiple-AI-agent correction below. Proposed research targets remain unvalidated.

## 1. Recommendation

Make WA Robot feel like **a team of configurable AI agents that handles different customer enquiries, with a shared inbox when people need to help**. AI agents are the existing AI bots: one business can maintain separate sales, support, wholesale or other agents, each with its own instructions, AI connection and collection tools. Simplifying navigation must preserve this core capability.

The everyday experience should answer three questions:

1. **Does any customer need us now?** Inbox shows the work that needs a person.
2. **Who is replying?** Every conversation clearly shows which named AI agent is selected and whether AI or the team is responsible.
3. **Is this worth paying for?** Dashboard shows recorded work, estimated time saved, and an understandable cost comparison.

My recommendation is to simplify the existing product around these questions, preserve its visual foundation, and move occasional configuration out of the daily workspace. Make value visible without suggesting every AI reply is a resolved enquiry or a cash saving.

## 2. Basis and current gaps

This plan uses [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md), the current source, the [existing design contract](./ux-revamp/design-system.md), and its [implementation notes](../.interface-design/system.md). It is a source review and design proposal, not a new browser audit or completed usability study.

The September 6 proposal files still contain some “not implemented” wording. Current code and implementation notes show that much of that work has shipped. Treat the source as evidence of current behavior; reconcile documentation during implementation.

| What exists now | Why it matters | Proposed enhancement |
| --- | --- | --- |
| Navigation exposes Overview, Impact report, Inbox, Contacts, bots, providers, tools, reply settings, campaigns, channels, Activity, Settings and Help | Occasional setup competes with customer work | Two primary destinations; a small secondary group; configuration inside Settings |
| Overview emphasizes setup, blockers and recent conversations | Useful operational foundation, but ongoing business value is elsewhere | Retain urgent issues; introduce a compact value summary after them |
| Impact report already records AI replies, customers assisted, response times, usage and savings estimates | We can reuse the calculation service | Simplify the owner view and add missing subscription/operating costs |
| Inbox offers “Use human replies”, “Use AI replies” and bot selection | Technical controls make a simple takeover feel like configuration | Prominent “Take over” and “Let AI reply”; move AI agent selection into details while keeping its name visible |
| Conversation mode and bot changes also update the contact's defaults | A temporary intervention can affect future enquiries | Separate conversation takeover from the customer's lasting preference |
| Manual sending cancels the waiting reply timer, but does not set human mode | Sending a message is not a lasting takeover | Explicit takeover and an atomic “Take over and send” operation |
| Activity is a paginated feed of individual messages/events, including token counts | A technician must reconstruct one customer's story across rows | Contact groups → conversations → ordered events → technical details |
| Users have sign-in accounts, but the schema has no roles or conversation assignee | Persona-based screens must not imply existing access control or named ownership | Start with shared team handling; add server-enforced permissions if needed |

The system design also predates some current functionality: provider accounts, media handling, the three global reply policies and the impact report are represented in current code. This plan builds on those capabilities.

## 3. People and priorities

| Person | Typical visit | What should lead |
| --- | --- | --- |
| Owner or manager | Checks whether enquiries are covered and the service earns its cost | Dashboard: issues, time saved, costs, supporting evidence |
| Admin, sales or executive staff | Reads a customer enquiry, takes over, replies and finishes | Inbox: needs attention, conversation history, reply controls |
| Setup administrator | Connects WhatsApp, maintains business information and adjusts behavior | Settings: agent management, guided setup and plain-language fields |
| Technical support | Investigates a failed reply, missing capture or unexpected cost | Activity: contact history and technical details |

These are job needs, not four required account types. In a small business, one person may do all four. Single tenancy means one business workspace; omit company switching and tenant administration. Multiple WhatsApp numbers and multiple AI agents can belong to that business. Single tenancy means one business workspace, not one robot. Agent names and roles describe customer groups; they are not separate user roles or accounts.

After setup, default new users to Inbox and remember their chosen start page. Offer Dashboard as the owner's start page. Do not infer permissions from that preference.

## 4. Navigation and information architecture

```text
Daily work
  Inbox                  [needs-attention count]
  Dashboard

More
  Contacts
  Broadcasts             [existing Campaigns]

Bottom of navigation
  Settings
  Help

Settings
  AI agents              [existing AI bots; multiple agents]
    Agent list
    Add agent with guided details and preview
    Edit each agent, custom instructions and collection settings
  WhatsApp numbers
  Automatic replies
  Customer details to collect
  Savings estimates
  Technical settings     [content side navigation]
    AI connection
    Google Sheets connection
    Activity
    Workspace preferences

Help
  Using the app
  Setup & troubleshooting
    Access and setup support
    Google Sheets connection guide
```

Keep a quiet WhatsApp status summary in the shell. A connection problem links directly to the affected number; moving configuration must not make repairs difficult to find. Technical users can bookmark Activity directly. AI agent management belongs in the ordinary business Settings group, outside Technical settings. Keep the existing `/bots` list, add/edit routes, provider bindings and per-agent tool assignments.

The Dashboard links to **Time & costs**, the simplified version of `/reports/impact`. A full report does not need a permanent primary navigation item. Keep one shared reporting service so the summary and detail cannot disagree.

Keep existing routes initially. This is a navigation and presentation change, not a requirement to rebuild routing. Preserve bookmarks and existing legacy redirects. “Broadcasts” retains the existing campaign functionality, including campaign detail and recovery actions.

Showing uncommon controls on secondary screens follows [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/). Here the dividing line is frequency and job: daily customer work stays visible; setup and diagnostics remain accessible when needed.

## 5. Inbox: the main working screen

### Layout

Desktop: navigation → conversation list → transcript and composer. Customer details open in a drawer rather than occupying a permanent fourth column. On phones, show the list or the conversation, with a clear Back action and drafts preserved.

```text
Inbox                          Search name or phone number
[Needs attention 4] [All open] [Done]
Filter: Everyone / AI assistant / Your team

Conversation list                 Selected conversation
Name · phone · business number   Aisha · +60…
Latest message                   Your team is replying     [Let AI reply]
Reason / waiting time            [Mark as done] [Customer details]
                                 ------------------------------------
                                 Customer / AI assistant / Team messages
                                 ------------------------------------
                                 Write your reply…                 [Send]
```

The counts and names above are illustrative, not production data.

Each list row should show the name, fallback phone number, latest customer-facing message, time and one useful attention reason. Show the business number when more than one is connected. Do not preview a raw tool payload instead of the customer's enquiry.

### Define “Needs attention” before building the tab

This is a proposed server-derived queue, not another name for every open conversation or every human-mode conversation.

Include open conversations with one or more of:

- An unanswered customer message that needs a person because AI replies are paused or unavailable.
- An explicit handoff request, once that event is implemented.
- A failed reply that has not been successfully addressed.
- A missed AI reply deadline beyond a defined processing grace period.

Keep a recoverable sheet-sync failure visible as a separate operational issue; it does not always mean the customer needs another message. Group shared connection failures into one banner plus affected conversation indicators.

Use the existing message triage rules: a decorative emoji alone should not become an overdue enquiry. Clear a reason when the underlying issue is addressed, not merely when someone opens the conversation. Opening and reading are separate from replying and completing.

Compute counts and filters across matching database records. The existing capped recent list cannot provide a reliable total. Sort urgent failures first, then longest actionable wait. Preserve selection and reading position when new work arrives.

### Reply ownership and conversation status are separate

| Situation | Visible state | Primary action |
| --- | --- | --- |
| AI is allowed to handle the conversation and no blocker is known | AI replies on | Take over |
| Team has taken over | Your team is replying | Let AI reply |
| Conversation allows AI but global replies are off | AI replies paused for everyone | Take over; authorized users can open reply settings |
| A connection or AI dependency blocks replies | Replies need attention + specific reason | Relevant recovery action |
| Conversation is closed | Done | Reopen |

Reserve “AI is writing…” for actual generation state. An enabled setting does not prove that a reply is being generated or that the channel is healthy. Keep “Who replies” separate from “Open / Done”.

### Takeover behavior

1. **Take over** pauses AI for this conversation and focuses the composer after the server confirms it.
2. Show persistent text: “Your team is replying. AI replies are paused for this conversation.”
3. If someone types while AI is enabled, the send action becomes **Take over and send**. Change mode and validate the send as one server operation; do not implement this as two unrelated browser requests.
4. **Let AI reply** explicitly hands the conversation back. Recommended behavior: answer outstanding eligible customer messages once; otherwise wait for the next message. Explain this beside the action.
5. **Mark as done** closes the conversation without silently changing the customer's default reply preference. A future enquiry follows that default and the global policy.

These are behavior changes. Today, PATCH mirrors mode and bot changes onto the contact. Introduce an explicit separate customer preference, such as “Use AI for this customer's new conversations”, under customer details. Preserve existing stored preferences during migration; do not reset everyone to AI.

Taking over must cancel scheduled replies and suppress an AI result still being generated. The current handler checks permission before generation, then sends the output without a fresh ownership check in that path. Add conversation/policy version checks and send coordination. Define the irreversible send boundary: a message already accepted by the gateway cannot be recalled. If a send is already in progress, show that condition honestly.

Keep takeover visible on mobile; it is currently inside folded controls. Ordinary conversation takeover needs immediate feedback and an undo path, not a confirmation modal. A global pause affects everyone and should clearly state its scope before confirmation.

Use “Your team”, not “You” or a staff member's name, until individual ownership is recorded. Shared handling also needs stale-state checks so two people cannot unknowingly overwrite each other's mode changes.

## 6. Dashboard: assurance, work and business value

Order the page by consequence:

1. **Needs your attention:** unanswered customer work and service blockers, with direct actions. Collapse this to a quiet healthy summary when empty.
2. **Time saved:** one prominent estimate with its period and assumptions visible.
3. **Work handled:** AI replies sent, customers assisted and response time.
4. **Time & costs:** estimated staff-time value, service costs and estimated value after costs; link to the calculation.
5. **Recent conversations:** a short list that opens Inbox with the relevant conversation selected.

```text
Dashboard                                  Last 30 days · [Change]
4 conversations need your team                            [Open inbox]

Estimated time saved
10 hours
Based on 300 AI replies × 2 minutes per reply

AI replies sent: 300       Customers assisted: …
Typical AI reply time: …   [View conversations]

Estimated staff-time value       RM 250
Service costs                    RM 120
Estimated value after costs      RM 130        [View time & costs]
```

These figures are a worked example, not a savings promise. Put the estimate explanation beside the figure; do not hide it exclusively in a tooltip.

Use “Last 30 days” for the existing rolling range. Do not rename it “This month” without implementing calendar boundaries and the business timezone. A partial month and a rolling 30-day period are different.

Retain 7/30/90-day detail views initially. Compare equal periods using the same assumptions, identify recalculated estimates, and avoid percentage growth from a zero baseline. Show the last-updated time and retain last-good data with a stale notice when refresh fails.

Before first use, show a short setup checklist. After completion, replace it with daily work and value; do not make a successful customer re-read onboarding every visit.

## 7. Savings that owners can understand and trust

### Build on the existing report

The current calculation uses sent AI reply records × estimated manual minutes, converts that to labor value, and subtracts priced AI usage. It already excludes campaigns, system notices and failed sends from service-reply counts, while including recorded AI usage costs from failed calls.

Keep those distinctions. Rename the current owner-facing “Net savings” to **Estimated value after AI costs** until the broader cost model is available. It currently excludes subscription and other operating costs.

| Metric | Definition and wording |
| --- | --- |
| AI replies sent | Recorded outgoing AI service replies with `sent` status. Here “sent” means accepted by the gateway, not delivered or read. |
| Customers assisted | Distinct recorded contacts receiving at least one such reply in the period; not confirmed sales or resolved enquiries. |
| Replies handled by AI | AI service replies ÷ all AI and human service replies. Never label this “enquiries resolved”. |
| Typical AI reply time | Median from the last customer message in a burst to the sent AI response. Keep that definition visible in details. |
| Estimated time saved | Sent AI service replies × user-confirmed manual handling time per reply. A proxy for avoided work, not measured working hours. |
| Estimated staff-time value | Estimated hours × user-confirmed hourly staff cost. Capacity freed for other work, not necessarily payroll reduced. |
| Service costs | Subscription plus separately charged AI usage and any explicitly included operating costs for the same period. |
| Estimated value after costs | Staff-time value minus service costs. May be negative. |

### Calculation example

```text
300 AI replies × 2 minutes                     = 600 minutes / 10 hours
10 hours × RM 25 per hour                      = RM 250 staff-time value
RM 99 subscription + RM 21 separately billed AI = RM 120 service costs
RM 250 − RM 120                                = RM 130 estimated value
```

If AI usage is included in the subscription, do not subtract it again. Define whether the report is showing the customer's costs or the provider's internal costs; the SME view should use the customer's costs. Label gateway/hosting fees as included, separately entered or excluded.

### Assumptions and safeguards

- Ask the owner once: “How long does a usual reply take your team?” and “What is your team's hourly cost?” Include reading and checking time, not just typing. Explain that either can be skipped.
- Example values are suggestions to confirm, not silently adopted facts. An unset assumption is unknown, not zero.
- Keep model pricing and token tables under technical details. The owner should not need to understand tokens to understand the report.
- Add subscription amount, billing dates, included usage and additional costs. Prorate recurring costs over the chosen reporting dates; show the method. Use one currency and an explicit conversion method where required.
- Missing AI prices or missing usage prevent a complete cost estimate. Show “Cost estimate incomplete”; do not display a positive net value based on zero-filled costs.
- A low or negative estimate should stay visible. Do not hide unprofitable periods or turn a failed response into a positive business outcome.
- Version assumptions or save period snapshots for historical comparisons. Otherwise explain that past estimates are recalculated using today's assumptions.
- Each metric should open its supporting records and “How this is calculated”. New filtered evidence endpoints may be needed; a generic Inbox link is not equivalent evidence.

The reply-count proxy can overstate savings when AI sends repeated, unnecessary or incorrect replies. Keep it clearly labeled. Later, add review/correction effort and conversation outcomes before claiming “enquiries handled without help”. A delivered reply, a saved lead and a completed sale are different outcomes.

Start with an in-app monthly review, available from Dashboard. A later opt-in email summary can reuse it. The business goal is understandable recurring value, not more logins: an owner who rarely visits because enquiries are handled well may be a successful customer.

## 8. Activity grouped by contact

Activity is a troubleshooting workspace. Keep technical detail available, but start with the customer affected.

```text
Activity
Search name or phone · Date range · Business number · Result
[By contact] [All events]

Contact             Last activity     Unresolved issues   AI cost
Aisha · +60…        2 minutes ago     1 reply failed      …
Daniel · +60…       8 minutes ago     None                …

Open contact → choose conversation → chronological timeline
09:20  Customer message received
09:20  AI reply requested
09:20  Customer details saved locally
09:20  Google Sheets sync failed      [View capture]
09:21  Reply accepted by WhatsApp
       [Technical details]            [Open in inbox]
```

This is a proposed timeline. Some events, such as ownership changes and reply-request lifecycle events, need new structured recording.

Implementation rules:

- Group using stable `contactId`, never display name. Show number and business-number context; do not silently merge separate contact records that happen to match.
- Within a contact, preserve conversation boundaries and channel identity. Use chronological ordering inside a conversation and newest activity for the contact list.
- Calculate group totals and issue states server-side across the selected range. Grouping only the current 25 event rows would give incomplete customer histories.
- Add server-side filters and stable cursor pagination. Existing `/api/messages?contactId=…` can support an initial contact drill-down, but does not supply the grouped summary or unified timeline.
- Combine message, AI usage, capture/sync and new handover events with stable source identifiers. Avoid counting the same tool invocation once as a system message and again as a capture.
- Keep token counts, model names, latency and diagnostic identifiers in technical detail. Do not expose credentials or full internal payloads by default.
- Show “New activity available” while someone reads history rather than shuffling rows beneath them. Preserve filters and contact selection in the URL.
- A sync retry must reuse the same capture identity and clearly show its latest outcome. An uncertain message send needs reconciliation before retry; do not offer a blind resend as an ordinary refresh.
- Events without a contact belong in a separate System events view. Do not invent customer attribution for connection-wide failures.

Inbox remains the place to reply. Activity links to the relevant conversation and capture recovery view instead of adding a second composer.

## 9. Setup that becomes quiet after completion

Setup should usually happen once, but business information still needs occasional maintenance. Make both straightforward.

1. **Connect your WhatsApp number.** Explain which business number to use and guide QR pairing. Distinguish a stored/previous connection status from a fresh connectivity check.
2. **Create the AI agents your business needs.** Give each a recognizable name and role/customer group, such as Sales enquiries, Customer support or Wholesale customers. Maintain each agent separately: business name, opening hours, relevant services/prices, common answers, language and when to ask a person. Guided fields produce that agent’s instructions; retain the existing custom-prompt editor, AI connection and collection tools. One agent’s save must not overwrite another. These fields are per-agent information, not a new shared knowledge base.
3. **Choose what each agent collects.** Optional customer details such as name, enquiry and preferred contact time. Keep Google Apps Script deployment and credentials in technical setup. Local capture and sheet synchronization need separate success states.
4. **Try a question with the selected agent.** An isolated preview uses that agent’s saved instructions; do not send a real WhatsApp message or write a live sheet from a test. Disclose AI usage cost if the preview calls a model.
5. **Choose customers and turn on replies.** Set an agent on each customer or several selected contacts for future conversations. In Inbox, set an agent for the current conversation. Choose a workspace default for customers without an assignment, then review number and reply policy before enabling. Groups are assigned by the team; the product does not infer customer segments from the role text.

Savings assumptions are an optional follow-up, not a blocker to receiving enquiries. The technician can prepare the AI connection; the business user reviews what the assistant should say.

Preserve the three global policies:

| Stored policy | Proposed label | Explanation |
| --- | --- | --- |
| `all` | Allow AI replies | AI can reply in eligible new and existing conversations. Conversations your team takes over stay with your team. |
| `existing` | Continue current AI conversations | Current AI conversations continue. New conversations start with your team. |
| `off` | Pause all AI replies | Your team can still receive and answer messages. |

Do not flatten these into an ambiguous on/off toggle. Routine configuration stays under Settings, while a clearly scoped “Pause all AI replies” emergency action remains reachable from Dashboard.

## 10. Wording guide

Use one consistent everyday vocabulary. Management uses “AI agents” (the existing AI bots); selection uses “AI agent” or “Agent”. Explain once that each agent is an assistant with its own job and customer information. Short reply-ownership labels can use “AI”. Prefer sentence case, specific actions and a recovery step when something fails.

| Current wording or technical concept | Proposed wording | Where / qualification |
| --- | --- | --- |
| Overview | Dashboard | Familiar business overview |
| Impact report | Time & costs | Report entry point |
| AI bots / Create bot | AI agents / Add AI agent | Ordinary business Settings; create and maintain multiple agents |
| Bot | AI agent | Contacts and conversation details; show the selected agent’s name |
| System prompt | Instructions for this agent | Existing custom instruction editor |
| AI providers | AI connection | Technical settings; provider/model names remain inside |
| Tools | Customer details to collect | Current sheet-capture capability; revisit if tool types expand |
| Capture / invocation | Saved customer details | Business view; invocation remains in diagnostics |
| WhatsApp channels | WhatsApp numbers | Avoid confusion with WhatsApp Channels |
| Use human replies | Take over | Only after takeover behavior matches the label |
| Use AI replies | Let AI reply | Show global blockers and pending-message behavior |
| Human | Your team | Sender/mode, until individual ownership exists |
| Resolve / Resolved | Mark as done / Done | Conversation state, not a verified customer outcome |
| Automation rate | Replies handled by AI | Explain denominator in details |
| AI reply turns | AI replies sent | Count the existing eligible sent reply records |
| Labor value | Estimated staff-time value | Estimated capacity value |
| Minutes per manual reply | Time your team spends on a reply | Savings assumption |
| Hourly labor cost | Your team's hourly cost | Savings assumption |
| Campaigns / Blast | Broadcasts | Existing bulk messaging |
| Activity | Activity | Keep for technicians; subtitle “Message history and troubleshooting” |

Recommended message patterns:

| Situation | Copy |
| --- | --- |
| First-use Inbox | “No customer messages yet. Connect your WhatsApp number to get started.” → Connect number |
| Attention queue empty | “No conversations need your team right now.” → View all open |
| Takeover confirmed | “Your team is replying. AI replies are paused for this conversation.” |
| Global pause blocks a handback | “AI replies are paused for everyone. Turn them on in Automatic replies.” |
| Definite send failure | “Your message wasn't sent. Your draft is saved.” → Try again |
| Send outcome unknown | “We couldn't confirm whether this message was sent. Check the conversation before sending again.” |
| Sheet sync failed | “Customer details are saved here, but haven't reached Google Sheets.” → View saved details |
| Missing time assumption | “Add your usual reply time to estimate time saved.” → Set reply time |
| Stale connection status | “Last reported connected at 10:42. We couldn't check again.” → Check connection |

Use the first-use copy only when its condition is true. A connected business with no messages needs different guidance from an unconnected one. Remove migration notices such as “Reply settings moved” after the transition; customers need the current task, not implementation history.

Start with plain English and test the labels with the actual SME audience. Keep strings ready for localization; choose Malay/Chinese or other language support based on customer research rather than assuming everyone in Malaysia shares a language preference.

## 11. Visual direction and accessibility

Continue the existing Source Sans 3 typography, light neutral surfaces, deep green actions, blue AI identity, neutral team identity, amber attention and red confirmed failure. Reuse `components/ui`, the transcript, overlays and async-state conventions.

The domain is a small business service desk: enquiries, reply responsibility, waiting customers, business numbers, saved contact details and daily results. Its color world is off-white correspondence, charcoal writing, green business signage, blue annotations, amber reminders and red corrections.

The distinctive interaction is **clear reply responsibility beside the customer conversation**, connected to evidence of work on Dashboard. Carry it through the Inbox row, thread header, takeover feedback, Dashboard attention row and Activity handover event.

| Common dashboard pattern | Decision for this product |
| --- | --- |
| Many equal KPI cards | Attention first; one dominant time-saved figure; compact supporting facts |
| All configuration permanently expanded | Two main destinations and a task-based Settings hub |
| Green means AI, connected, enabled and successful | Separate reply ownership, connectivity and result, with text labels |

Keep 16px conversation text, 14px interface body, 16px operational panel spacing and 24–32px between independent sections. Aim for approximately 320–360px conversation lists on wide screens, adapting to available space. Important takeover controls must not require horizontal scrolling or expanding advanced controls.

Maintain keyboard navigation, visible focus, readable labels and non-color status cues. Use 44px touch targets as the product target; WCAG 2.2 AA's minimum target criterion is 24 CSS pixels with specified exceptions, not a blanket 44px rule. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

Announce confirmed takeover, send failures and relevant updates without moving keyboard focus unexpectedly, following [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages). Preserve drafts, selection and reading position during polling. Validate reflow at 320/390px and desktop widths, text zoom, loading, empty, stale and failure states.

## 12. Delivery plan

Priority is dependency-driven. The effort column is relative scope, not a delivery promise.

| Phase | Deliverable | Main implementation areas | Exit condition | Effort |
| --- | --- | --- | --- | --- |
| 1 — Simplify daily work | Navigation, Settings grouping, wording, mobile takeover visibility, report value summary using current honest labels | Dashboard layout, Settings, Inbox, Dashboard, impact report and shared status copy | Staff can find Inbox, takeover and Dashboard without passing setup pages; totals reuse the report service | Small–medium |
| 2 — Make takeover reliable | Separate contact default from conversation mode; atomic takeover/send; generation/send coordination; mode event history; explicit handback behavior | Conversation APIs/service, incoming handler, reply scheduler, outgoing send path, schema | Delayed AI generation cannot initiate a send after takeover is confirmed; future conversations retain the intended contact preference | Medium–large |
| 3 — Make attention actionable | Shared attention reasons, accurate totals, server filtering/paging, outstanding-message handling and recovery links | Conversation list APIs, triage, issue derivation, Inbox and Dashboard | The same record set drives queue and badge; no false zero caused by list limits | Medium |
| 4 — Complete business value | Subscription/included usage model, period cost allocation, disclosed historical recalculation, evidence links, owner/technical report separation | `lib/reports/impact.ts`, impact types/API, schema, report UI | Worked examples reconcile; unknown costs stay unknown; Dashboard and report match | Medium |
| 5 — Group technical Activity | Contact summaries, conversation timelines, unified event detail and stable pagination | Activity page, message/usage/capture queries, new mode events | One contact's history can be investigated without reconstructing a global feed | Medium |
| 6 — Improve setup and validate | Per-agent guided setup, isolated selected-agent preview, user testing and documentation alignment | Settings, bot/tool editors, preview backend, Help, system design | A nontechnical administrator can configure and test the assistant with guided support | Medium–large |

Phase 1 may expose the existing takeover action more clearly, but must retain truthful scope/help text until Phase 2 changes its behavior. Do not ship “this conversation only” while the API still changes contact defaults.

Phase 4's report simplification can begin in Phase 1; its new cost claims must wait for the data model. Phase 5 can start from existing contact-filtered messages, but full history needs the new event records.

If more than one access level is required, add server-enforced roles before restricting setup or financial reports by role. Until then, this is simpler navigation within the existing access model, not a security boundary.

## 13. Validation and success criteria

Recruit a small first round of 5–6 representative SME owners and staff, plus a technician for Activity. These are proposed product targets, not established research results.

| Task | Proposed acceptance target |
| --- | --- |
| Find a customer who needs help | At least 4 of 5 participants succeed without guidance within 15 seconds |
| Take over and send a reply | At least 4 of 5 succeed within 30 seconds and correctly explain whether AI remains paused |
| Hand back to AI | Participants understand both global restrictions and what happens to the waiting message |
| Understand value | At least 4 of 5 distinguish estimated time value, service cost and actual cash savings |
| Investigate a failed interaction | Technician reaches the relevant contact, conversation and failure detail within three navigation actions |

Required implementation checks include: takeover during generation, global pause during generation, send already in progress, two operators changing mode, failed/uncertain send, resolve followed by a new enquiry, missing cost rates, zero/negative value, period boundaries, contact histories spanning pages, duplicate capture events and reconnect/stale-data states.

Track task completion, unanswered enquiry age, takeover conflicts, failed sends and whether owners understand the report. Track recurring value and retention together; report views alone do not prove the product helped. Collect workflow events without logging message bodies unnecessarily.

## 14. Scope decisions

Start with **navigation and language, reliable takeover, and a clear Dashboard value summary**. These most directly support the everyday user described in the brief.

Keep multiple-agent management visible under business Settings. Custom instructions and technical model configuration remain available for each agent. Defer individual assignment, internal notes, CRM pipelines, revenue attribution, automatic satisfaction scoring and a visual automation builder until customer evidence justifies them. A “human requested” queue requires an explicit structured handoff signal; prompting the AI to say it will fetch a colleague is not sufficient.

Confirm these business choices during implementation planning: who pays AI/gateway charges, how subscription costs are supplied, whether staff need separate permissions, which languages matter first, and whether phone-originated staff replies are captured reliably. None blocks this proposed direction, but each affects the accuracy of particular controls or metrics.

The product should make a small business feel that customer enquiries are being looked after, that a person can step in confidently, and that the value shown can be checked.


## 15. Execution record — 16 September 2026

Implemented in the working tree. This section describes shipped code separately from
proposed user-research targets above.

| Area | Implemented behavior |
| --- | --- |
| Daily navigation | Inbox first and default start; Dashboard second; infrequent setup grouped in Settings; per-browser start preference; familiar agent/team/broadcast labels; AI agents promoted to ordinary business Settings. |
| Inbox | Shared server attention derivation, full-record counts, search/ownership filters and 25-record pages; clear reasons and phone-visible takeover; per-conversation drafts and reading-position preservation. |
| Takeover | Version-checked ownership updates; atomic team claim before manual send; cancellation of scheduled generation; eligibility checks between model/tool rounds and before send; separate future contact defaults; explicit eligible-message handback. Already-started sends/actions cannot be recalled. |
| Dashboard | Actionable attention and connection/setup blockers first; shared business-value summary; emergency global pause; recent open conversations; collapsed setup summary. |
| Time & costs | Subscription, other monthly charges, billing anchor and included/separate AI fields; actual UTC billing-cycle proration; unknown and negative values preserved; effective model prices; final-call reply-value attribution avoids duplicate preprocessing value. |
| Activity | Stable contact-ID grouping, whole-period counts/costs, contact and conversation drilldown, combined messages/ownership events/captures/usage, stable cursor pages and capture retries without a duplicate lead. Manual refresh preserves reading order. |
| Guided setup | Structured facts create/update separate named agents with their own role/customer group; legacy guided data stays bound to its original agent; existing custom instructions require explicit confirmation before conversion; no silent enablement, routing change or replacement of other agents; isolated one-question preview without tools, customer rows or WhatsApp sends; charged preview usage recorded separately. |
| Accessibility and wording | Wrapping segmented controls with keyboard selection, touch-sized controls, maintained native-dialog focus/Escape behavior, clear ownership/send wording and error/unknown states. |
| Documentation | Updated system design, Inbox/Dashboard guides, design implementation contract and evidence records. |

Cost policy is explicitly owner-entered: one reporting currency, no inferred foreign
exchange rate, and AI subtracted only when separately billed. Historical report
estimates use current assumptions, visibly disclosed, rather than claiming a stored
historical snapshot. Other monthly charges allow explicit gateway/hosting costs.

The current single-admin access model remains. Structured human-request handoff,
individual assignment, CRM, revenue attribution and opt-in emailed summaries remain
the deferred scope in section 14. Human-help business instructions are prompt content;
they do not claim the team was notified. System-wide Activity currently includes
unassigned/preview records; it does not imply a new comprehensive gateway audit log.

### Verification completed

- `pnpm test:uiux`: populated pre-enhancement database upgrade, future-preference and inherited-assistant preservation, takeover during generation, global pause/resume suppression, already-started send completion, stale update rejection, eligible handback, decorative-message exclusion, accurate totals beyond a visible page, same-name contacts and cursor ties, unknown/included/negative costs, month-end billing anchors and no duplicate multi-model reply value.
- `pnpm test:format` and `pnpm test:media`: existing channel formatting and media regression checks.
- TypeScript, ESLint and production build checks.
- Private Playwright browser with a synthetic local database: real login, confirmed takeover and composer focus, stale API conflict, separate contact preference, contact/conversation Activity drilldown, Escape dismissal, business-details save and confirmed global pause.
- Six screens at 1440, 390 and 320px: no horizontal page overflow or browser page errors. Preview UI response was mocked; the checks did not call paid AI or a live customer integration.

See [screenshots and observations](./ux-revamp/evidence/20260916/README.md).
Database migrations 0011–0013 are included and automatically applied by the existing
startup migration path. Tests upgraded temporary databases only; the customer database
was not migrated during development.

### Remaining field validation

Representative SME task testing and live WhatsApp/AI/Google Sheets integration testing
require a deployment with the intended business configuration. No usability completion
rates, live delivery guarantees or actual payroll savings are claimed from the automated
checks. Activity currently derives period aggregates synchronously; benchmark larger
customer histories before introducing cached aggregates or a dedicated event store.


## 16. Multiple-agent requirements and verification

Multiple configurable AI agents are a core product requirement. The `/bots` management
surface is retained and exposed as **AI agents** in Settings → Your business. Staff can
maintain agents for different customer groups without opening Technical settings.

- **Independent configuration:** each agent owns its name, role/customer group, guided facts or custom instructions, AI provider and allowed collection tools. Providers may be shared. Guided profiles are selected by `botId`; editing one preserves every other agent, disabled state, tools and workspace default.
- **Explicit customer selection:** Contacts chooses the agent for future enquiries, with bulk selection available. Inbox chooses the current conversation’s agent independently. Its reply-status line shows the effective agent. Changing the active agent suppresses obsolete generation and schedules eligible waiting input for the newly selected agent when AI is allowed.
- **Default routing:** a new conversation snapshots the customer’s assigned agent. Unassigned conversations use the workspace default and then the legacy default flag; disabled agents are skipped. Later contact preferences do not silently change an active thread. No automatic customer classification is claimed.
- **Maintain existing robots:** original agent IDs, custom prompts, provider choices, tool assignments and add/edit APIs stay available. A guided save on an existing custom agent requires explicit replacement confirmation. Unsupported external-runtime agent types retain their custom editor and are not converted by guided setup.
- **Preview scope:** test the named saved agent, save changed instructions before previewing, and disclose AI cost. Preview does not send WhatsApp messages or run capture tools.
- **Upgrade:** migration 0013 adds the agent-role field with an empty default. Earlier singleton guided records remain accessible and are editable from their original agent; new guided agents receive independent profile rows. Customer databases were not migrated during development.

Regression coverage includes creating two guided agents, editing one without modifying
the other, preserving disabled state/tools/defaults, rejecting stale edits and unconfirmed
custom-prompt conversion, preserving legacy guided identity, selecting a customer's sales
agent for an active thread and its support agent for a later enquiry. Browser checks cover
multiple-agent creation/editing, selected-agent preview, customer and conversation choices,
and Settings/list/setup reflow. Live integration and representative SME usability remain
field validation.


## 17. Settings and Help navigation inside the content

Settings opens on **AI agents**. Remove the Overview tab: it adds an extra stop before
configuration. Persistent navigation sits above the page heading inside `main`, with a
Settings/current-section breadcrumb and real URL links:

```text
AI agents | WhatsApp numbers | Automatic replies |
Customer details | Savings estimates | Technical settings
```

Agent list, add, edit and guided pages keep AI agents selected. Daily Inbox, Dashboard,
Contacts, Broadcasts and Help do not show Settings navigation. Existing module URLs and
the legacy `/settings#auto-reply` shortcut remain usable.

Technical settings opens on **AI connections**. Its second navigation level is a side
navigation inside the content container, alongside the selected page:

```text
Technical settings        Selected configuration or Activity
  AI connections
  Google Sheets
  Activity
  Workspace preferences

  Setup & troubleshooting help
```

Google Sheets uses `/settings/technical/google-sheets` and reuses the existing collection
editor. Add/edit pages retain the technical side navigation; save, cancel and delete return
to Google Sheets. Customer details remains the business-facing collection view. Both
views use the same tools and APIs. Workspace preferences retains the browser start-page
choice formerly on Overview.

Help has two content tabs: **Using the app** for takeover, handback and time/cost guidance;
**Setup & troubleshooting** for initial setup, connection repair, capture recovery and
reference articles. Access and setup support is a Help article at `/help/access`; the old
`/settings/access` URL redirects there. Google Sheets guidance belongs in the same Help
section, while its actual configuration stays in Technical settings.

Section links wrap on narrow screens, retain touch-sized targets, visible focus and
`aria-current`. The technical side navigation becomes a compact two-column link group
above the content on phones. Navigation adds no data polling.

Earlier navigation evidence is retained in [Settings navigation evidence](./ux-revamp/evidence/20260916/settings-navigation/README.md).
Final verification: TypeScript, ESLint and the production Webpack build passed. A private browser completed 19 navigation
and interaction checks, including Google Sheets save/cancel context, browser preference
persistence and legacy redirects. All 24 reflow checks at 1440/390/320px passed with no
page errors or horizontal page overflow. See [Settings and Help evidence](./ux-revamp/evidence/20260916/settings-help-navigation/README.md).
