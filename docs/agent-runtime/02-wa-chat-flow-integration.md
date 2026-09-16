# Plan 2 — Running WA Chat Flow on the AI Agent Runtime Gateway

**Repository:** `prv/wa-chat-flow` (Next.js 16 + SQLite)
**Depends on:** [Plan 1](./01-gateway-service-api.md) steps 1–6.
**Goal:** a deployment where the Agent Runtime answers every thread and the
local AI Bot machinery is not merely bypassed but absent.

## The shape of the change

```
WhatsApp → WAHA → webhook → WA Chat Flow → Agent Runtime Gateway → Open Notebook + LLM
                                  ↑                                        │
                                  └────────── reply text ──────────────────┘
```

Everything left of the gateway is unchanged. Deduplication, `@lid` resolution,
the debounce scheduler, `sendOutgoingMessage`, the Inbox, Logs, Contacts and
Campaigns do not move. The change is confined to **who produces the reply text**.

## Why the seam is already there

`resolveHandler` in `lib/ai/handler.ts` has one caller — `runAutoReply` in
`lib/messaging/incoming-handler.ts` — and already reserves the branch:

```ts
case 'external_agent':
  throw new Error(
    `Bot "${bot.name}" is set to external_agent, but no Agent Runtime is configured yet.`
  )
```

`AIOutput.connection` is already documented as *"Absent for a handler that does
not call an LLM."* `ai_usage.provider_id` is already nullable. The door was left
open on purpose; this plan walks through it.

---

## Decision 1 — a deployment gate, not a per-bot setting

`ai_bots.handler_type` is a per-row column, but this integration is a **property
of the deployment**. Gate it on the environment:

```bash
AGENT_RUNTIME_URL=https://gateway.internal/api/v1   # presence = external mode
AGENT_RUNTIME_SERVICE_TOKEN=...
AGENT_RUNTIME_TENANT_ID=default
AGENT_RUNTIME_CHANNEL=whatsapp
AGENT_RUNTIME_TIMEOUT_MS=60000
AGENT_RUNTIME_MAX_MESSAGE_CHARS=2000
```

`mode = AGENT_RUNTIME_URL ? 'external' : 'local'`, read once in `lib/config.ts`
like every other variable in this codebase.

**Why not a `system_settings` row.** A runtime toggle would strand in-flight
replies and leave a workspace whose bot prompts silently stopped mattering — an
operator editing a prompt that no longer does anything is the worst failure this
integration can produce. Deployment topology is already handled this way here
(`waha.baseUrl`, `dataDir`).

`handler_type` stays as it is. In external mode `resolveHandler` ignores it; in
local mode nothing changes. **No migration, no behaviour change for existing
deployments.**

## Decision 2 — the gateway owns the agent's memory

The gateway persists conversations and messages in PostgreSQL, replays them on
resume, and its `getOwned()` requires its own conversation row to exist. Its
retrieval and prompt pipeline are built on that store.

So wa-chat-flow sends **only the unanswered burst**, not the transcript, and
keeps a pointer to the gateway's thread.

This is a deliberate reversal of the obvious design (ship full history to a
stateless runtime). Fighting the gateway's memory model would mean fighting its
whole design, and would duplicate the transcript in two databases with no
tiebreaker.

**The cost, stated plainly:** when an operator answers by hand in the Inbox, the
gateway does not learn. Plan 1 §7 (`MessageRole.AGENT` write-back) is the fix,
and it is scheduled here as Phase 4. Until it ships, a thread that a human took
over and then handed back may get an answer that ignores what the human said.

**What does not change:** `buildContext` stays exactly as it is. The burst is
still derived from the last thing anyone else said, it still survives a restart,
and an operator's reply still ends a burst. It decides *what to send*; it simply
stops being the model's whole memory. **Do not add a cursor column.**

## Decision 3 — one system bot row, owned by the system

`runAutoReply` returns `no_bot` when `selectBot` finds nothing, and `ai_usage`,
the Logs joins and the Inbox all reference a bot. Rather than restructure that,
seed a single **"Agent Runtime"** bot row in external mode at a reserved id:

```ts
export const AGENT_RUNTIME_BOT_ID = 'agent-runtime'   // handler_type = 'external_agent'
```

Its `prompt` and `provider_id` go unused — the agent profile lives in the
gateway. The row exists so `selectBot` resolves, foreign keys stay intact and
every log line has something to attribute.

**It is a system row, not a configurable one.** An operator cannot create, edit,
delete, or attach tools to it, and no dashboard surface offers to. This is the
whole point of running external: the agent's behaviour is defined in the
gateway, and a second place to define it is a second source of truth that will
disagree.

A reserved id plus `handler_type` identifies it — no new column, no migration.

### No tools. Structurally, not conditionally.

An external-agent bot **never** gets tools. The gateway has its own tool calling,
its own knowledge base and its own escalation policy; handing it a second,
locally-defined tool schema would let a capture fire twice, once on each side,
with neither aware of the other.

Enforced at four layers, so no single mistake re-opens it:

| Layer | Guarantee |
|---|---|
| `resolveTools()` | Returns `[]` for any bot whose `handler_type` is `external_agent` — a **per-bot** rule that holds in local mode too, not just a deployment-mode check |
| `ExternalAgentHandler` | Ignores `input.tools` entirely; there is no code path that forwards a tool schema to the gateway |
| Bots API | Refuses `toolIds` for the system bot with `403`, in every mode |
| Seed | Deletes any `bot_tools` row pointing at the system bot on every boot |

The first layer is the important one. Making the rule a property of the *bot*
rather than of the *deployment* means a database carried over from a local-mode
deployment cannot smuggle tools in through a stale attachment.

### `selectBot` short-circuits in external mode

`selectBot` walks conversation → contact → settings default → `is_default`. A
deployment migrated from local mode still has the old bot rows, and contacts
still point at them.

In external mode, `selectBot` must return the system bot **unconditionally**,
ignoring that chain. Two reasons:

- **Correctness.** `resolveHandler` short-circuits anyway, so a stale bot would
  still reach the gateway — but it would carry its own id into `ai_usage` and
  the Logs, attributing gateway spend to a bot that is not answering.
- **The tool guarantee.** A stale local bot has `handler_type = 'direct'` and may
  have tool attachments. Short-circuiting means the tool rule above is evaluated
  against a bot that structurally has none.

The old rows stay on disk, inert and invisible. This plan does not delete them:
a deployment that switches back to local mode should find its bots intact.

---

## Work items

### 1. `lib/config.ts` — the runtime block

```ts
export const agentRuntime = {
  mode: process.env.AGENT_RUNTIME_URL ? 'external' : 'local',
  baseUrl: (process.env.AGENT_RUNTIME_URL || '').replace(/\/+$/, ''),
  serviceToken: process.env.AGENT_RUNTIME_SERVICE_TOKEN || '',
  tenantId: process.env.AGENT_RUNTIME_TENANT_ID || 'default',
  channel: process.env.AGENT_RUNTIME_CHANNEL || 'whatsapp',
  timeoutMs: Number(process.env.AGENT_RUNTIME_TIMEOUT_MS || 60_000),
  maxMessageChars: Number(process.env.AGENT_RUNTIME_MAX_MESSAGE_CHARS || 2_000),
} as const
```

In production, external mode without a service token must fail at boot, the way
`required()` already treats `JWT_SECRET`.

### 2. `lib/ai/runtime-mode.ts` (new)

A tiny predicate module — `isExternalMode()` — in the style of
`lib/settings/auto-reply.ts`, so route handlers and pages import a named helper
rather than re-deriving the check.

### 3. `lib/ai/external-handler.ts` (new)

`ExternalAgentHandler implements AIHandler`. **The only file that knows the
gateway's wire format**, exactly as `lib/wa/waha-provider.ts` is for WAHA. Apply
the same rule: never import it outside `lib/ai/`; callers use `resolveHandler()`.

Responsibilities:

- `POST {baseUrl}/agent/reply` with `x-service-token`
- `visitorId = 'wa_' + contactId` — stable, and keeps the phone number out of
  the gateway's JWT subjects and logs. **Never send the raw phone as the id.**
- `requestId` = a deterministic idempotency key (see §7)
- `conversationId` from the local pointer column, or `null` to create
- Truncate the burst to `maxMessageChars`, and record that it was truncated
- `AbortSignal.timeout(timeoutMs)`
- Map the response into `AIOutput`; leave `connection` undefined
- Map error codes to thrown errors carrying a stable reason

**`input.tools` is ignored.** The type still carries the field because
`AIHandler` is shared with `DirectAIHandler`, but this handler has no code path
that forwards a tool schema. That is the second of the four layers in
Decision 3, and it is what makes the guarantee survive a caller that one day
passes tools by mistake.

The handler returns text. It does **not** send WhatsApp messages, write message
rows or flip conversation modes — `runAutoReply` owns all of that, and keeping
it that way is what makes the local and external paths interchangeable.

### 4. `lib/ai/handler.ts` — the short-circuit

```ts
export function resolveHandler(bot: Bot): AIHandler {
  if (isExternalMode()) return externalHandler   // ignores bot.handlerType
  switch (bot.handlerType) { /* unchanged */ }
}
```

Replace the `external_agent` throw with a message that names the missing
configuration, so a half-configured deployment reports why rather than what.

### 5. Schema — the conversation pointer

```ts
// lib/db/schema.ts → conversations
/** The Agent Runtime's conversation id. Null until the first reply opens one. */
agentConversationId: text('agent_conversation_id'),
```

Then `pnpm db:generate`. Nullable, no backfill, inert in local mode.

Write it back after the first successful reply. If the gateway answers `404`
(thread closed or pruned on its side), clear the column and retry once with
`null` — a closed remote thread must not wedge a live WhatsApp conversation.

### 6. `lib/ai/usage.ts` — widen the billing identity

`recordUsage` takes a `BotConnection`, which demands `providerId`, `kind` and
`model`. Widen it to accept a looser identity so a call with no local provider
row can still be recorded:

- `provider_id: null` — already nullable
- `kind: 'external_agent'`
- `model:` whatever the gateway reports, else `'unknown'`
- `round: 0` — the gateway's internal rounds are its own ledger

The two-phase `attachUsageToMessage` flow is unchanged and still required: the
call still happens before the message row exists, and a failed reply still
spent tokens.

**Check `app/api/ai-providers/[id]/usage`** — it groups by provider, so rows with
a null `provider_id` will not appear. Add an "Agent Runtime" bucket or the
dashboard will report zero cost while the gateway bills.

If the gateway returns no usage, write nothing rather than a zero row. The
convention here is that a dash means "no model was called" and a zero means
"a model was called and cost nothing" — collapsing them hides outages.

### 7. Idempotency

`runAutoReply` can fire from the debounce timer **and** from
`resumePendingReplies()` after a restart. Plan 1 §4 makes a duplicate replay the
stored answer, but only if the key is stable across both callers.

Derive it from data, never from a clock or a fresh UUID:

```
requestId = `${conversationId}:${lastPendingMessageId}`
```

Both callers re-read the same pending burst, so both compute the same key. A
restart mid-flight then replays the existing answer instead of paying for a
second generation.

### 8. Handoff → human mode

When the response carries `handoffRequired: true`, after sending the reply:

- set `conversations.mode = 'human'`
- call `cancelAutoReply(conversationId)`
- write a `sender_type = 'system'` row so the Inbox shows why it switched

The CLAUDE.md rule applies unchanged: **anything that claims a thread must call
`cancelAutoReply`.** This is one of those things.

### 9. Typing indicator and timeout

`runAutoReply` calls `setTyping` once before the handler. WhatsApp's indicator
expires in roughly 25 seconds, and the gateway's `ask-compose` mode is measured
at about 12s to *first* token — comfortably past that end to end.

Add a heartbeat that re-sends `setTyping` every ~10s while the call is in
flight, cleared in the existing `finally`. It must stay best-effort and must
never throw: `setTyping` is cosmetic, older WAHA builds have no `/presence`
route, and losing the indicator is never a reason to abandon the reply.

Keep `AGENT_RUNTIME_TIMEOUT_MS` well under the scheduler's `STALE_AFTER_MS`
(10 minutes) so a hung gateway cannot wedge a thread past the point where the
window would be dropped anyway.

### 10. Failure handling — no fallback

If the gateway is unreachable, let it fail. `recordAiFailure` already writes the
visible system row, and the existing convention is explicit: a missing provider
is a hard failure reported in the thread rather than an answer on a guessed
default. Silently falling back to a local bot with an empty prompt would answer
a customer in the wrong voice with no knowledge base — worse than not answering.

Retry only on `502`/`504`, once, with the same `requestId`. Never retry `409`;
that means a generation is already running, and the reply will land from the
call that owns it.

### 11. Deployment gate in the dashboard

In external mode the local AI Bot machinery must be **absent, not merely
inert** — an operator editing a prompt that does nothing is the failure this
whole design avoids.

**Navigation and pages**

- `app/(dashboard)/layout.tsx` — filter the *AI bots*, *AI providers* and
  *Tools* nav entries
- `/bots`, `/bots/new`, `/bots/[id]`, `/ai-providers`, `/tools` — redirect to
  `/settings`

**Write APIs** — *hidden navigation is not access control*; a bookmarked URL, a
stale tab or a `curl` still reaches the route:

| Route | External mode |
|---|---|
| `POST /api/bots` | `403` |
| `PUT /api/bots/[id]` | `403` |
| `DELETE /api/bots/[id]` | `403` |
| `POST/PUT/DELETE /api/ai-providers*` | `403` |
| `POST/PUT/DELETE /api/tools*` | `403` |

`PUT` and `DELETE` on the **system bot** return `403` in *every* mode, not only
external. The row is system-owned, and a deployment that toggles back to local
should not find it half-edited.

**Bot selection surfaces.** With one system bot, choosing a bot is meaningless —
and a stale choice is actively harmful, since it would attribute gateway spend
to a local bot row:

- `app/(dashboard)/inbox/page.tsx`, `contacts/page.tsx`,
  `contacts/contact-profile.tsx` — hide the bot picker
- `app/api/contacts/[id]/route.ts` — ignore `aiBotId`
- `app/api/conversations/[id]/route.ts` — ignore `botId`

> **Do not touch `mode` or `status` on those routes.** The auto/human toggle and
> resolve are how an operator takes a thread over, and they matter *more* in
> external mode, not less. Only the bot *choice* disappears.

**Tools**

- `lib/tools/registry.ts` — `resolveTools()` returns `[]` for any
  `external_agent` bot (Decision 3, layer one)

**Settings** gains a read-only **Agent Runtime** panel: base URL, tenant,
channel, the system bot's name as it appears in Logs, and a health probe against
Plan 1 §9 — mirroring how WhatsApp session status is already surfaced. Read-only
is the point: it tells an operator where replies come from and gives them
nothing to misconfigure.

Leave the Logs and Inbox untouched otherwise. They describe what happened, and
what happened is still WhatsApp messages.

### 12. Seed — self-healing, every boot

In external mode, reconcile the system bot at the reserved id on every boot
rather than creating it once:

1. Insert it if absent (`handler_type = 'external_agent'`, `enabled = true`,
   `provider_id = null`, a fixed name such as *Agent Runtime*)
2. Re-assert `enabled = true` and `provider_id = null`
3. **Delete any `bot_tools` rows pointing at it** — Decision 3, layer four

Step 3 is the one that matters. Direct database edits, a restored backup, or a
future bug are all ways a tool attachment could appear on a row that must never
have one; reconciling on boot means the window closes at the next restart rather
than staying open indefinitely.

Idempotent, and it must not run in local mode. Follow the lazy pattern used by
`ensureSessionsReconciled()` — **not** an `instrumentation.ts` hook, for the
reason recorded in CLAUDE.md.

---

## Phasing

| Phase | Contents | Visible change |
|---|---|---|
| **1 — Core** | §1–§7 | None. Local mode is byte-identical; external mode answers from the gateway |
| **2 — Gate** | §11, §12 | The AI Bot surfaces disappear in external deployments |
| **3 — Hardening** | §8, §9, §10 | Handoff flips to human; typing survives slow answers |
| **4 — Write-back** | Post operator replies to Plan 1 §7 | The gateway stops re-answering what a human handled |

Phase 1 is the only phase blocked on Plan 1. Phases 2 and 3 are local work and
can proceed against the recorded fixture.

**One exception to the phasing:** Decision 3's tool guarantee (layers one and
two — `resolveTools()` and the handler ignoring `input.tools`) belongs in
**Phase 1**, not Phase 2. Layers three and four are enforcement against
tampering and can wait for Phase 2; layers one and two are what stop a tool
schema reaching the gateway on the very first reply.

## Testing

| Level | What |
|---|---|
| Unit | `isExternalMode()` across both configurations |
| Unit | Burst truncation at the character cap |
| Unit | `requestId` is identical for the timer and restart-recovery callers |
| Unit | Response → `AIOutput` mapping, including absent `usage` |
| Integration | A `404` on a stale pointer clears it and retries once |
| Integration | `handoffRequired` flips mode and cancels the pending reply |
| Integration | Gateway down → system row in the thread, no send, no crash |
| Integration | Write APIs answer `403` in external mode |
| **Unit** | **`resolveTools()` returns `[]` for an `external_agent` bot even with `bot_tools` rows present, in *local* mode** |
| **Unit** | **`selectBot` returns the system bot in external mode despite a contact pointing elsewhere** |
| **Integration** | **`PUT`/`DELETE` on the system bot answer `403` in both modes** |
| **Integration** | **`toolIds` in a bots write is refused for the system bot** |
| **Integration** | **Seed deletes a hand-inserted `bot_tools` row for the system bot on boot** |
| **Integration** | **`aiBotId` / `botId` are ignored in external mode, while `mode` and `status` still apply** |
| Manual | A real burst of three WhatsApp messages produces one reply |

Run the full local-mode suite unchanged at the end of Phase 1. Nothing in this
plan may alter behaviour when `AGENT_RUNTIME_URL` is unset.

## Open questions

1. **Lead capture — the one that can't wait.** The gateway has
   `lead.service.ts` writing to PostgreSQL; wa-chat-flow has tools → Apps
   Script → Google Sheets. Decision 3 removes the local path outright in
   external mode, and that rule now lands in **Phase 1**.

   So if the Sheet is what the business actually works from, leads stop arriving
   there the moment external mode is switched on. The fix is an inbound
   tool-callback endpoint the gateway calls, reusing `executeTool` and
   `recordToolRun` unchanged — the sink, the validation and the
   `tool_invocations` audit trail all still work; only the *caller* changes from
   a local tool loop to an HTTP request.

   That is a Plan 1 work item as much as a Plan 2 one, and it is not currently
   scoped in either. **Decide before Phase 1 ships**, not before Phase 2.
2. **Answer provider.** `gateway-rag` (~1.8s) or `ask-compose` (~12s to first
   token) for WhatsApp? This sets the §9 timeout.
3. **Tenancy.** One `tenantId` per deployment, or one per WhatsApp session if
   several businesses share a gateway?
