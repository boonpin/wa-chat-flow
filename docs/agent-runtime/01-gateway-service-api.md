# Plan 1 — A server-to-server reply API on the AI Agent Runtime Gateway

**Repository:** `prv/ai-agent-runtime-gateway` (NestJS)
**Depends on:** nothing. This plan ships and is useful on its own.
**Consumed by:** [Plan 2](./02-wa-chat-flow-integration.md).

## Why this plan exists

The gateway today has exactly one way to send a customer message and get an
answer: the Socket.IO namespace `/ai-support`, event `chat:send`. That path is
built for a browser widget and carries three assumptions a server-to-server
caller cannot satisfy.

**Generation is detached.** `OrchestrationService.handleChatSend` returns
`Promise<void>`; the answer arrives later as `chat:delta` and `chat:complete`
events on a room. There is no return value to await.

**A socket is bound to one conversation.** The handshake resolves a single
conversation and joins its room (`ai-support.gateway.ts`, `handleConnection`).
A caller with a thousand live WhatsApp threads would need a thousand sockets.

**Authentication is anonymous-visitor shaped.** `POST /api/v1/ai-support/session`
exchanges nothing for a short-lived JWT — correct for a public widget, wrong as
the front door for a trusted backend.

The REST controllers cover session, history, handoff, lead and feedback. None of
them generates a reply.

So this plan adds the missing surface: **one synchronous, authenticated,
channel-aware HTTP endpoint that runs the existing pipeline and returns the
answer.**

## What this plan is not

It is not a second pipeline. The prompt layers, agent profile, retrieval,
escalation policy and activity records stay exactly where they are. An answer
that reaches a WhatsApp customer without passing through the profile prompt is
the same bug it would be on the web — the README's rule holds for every channel.

The precedent for driving the stack headlessly already exists:
`RegressionRunner` replays golden cases through the real answer provider. It
deliberately creates no conversation and no message rows, and a test asserts
that property. **This endpoint is the opposite** — it must persist a turn, so it
goes through `OrchestrationService`, not around it. Do not extend
`RegressionRunner` into a serving path.

---

## The contract

```
POST /api/v1/agent/reply
x-service-token: <shared secret>
Content-Type: application/json
```

```jsonc
{
  "tenantId":       "default",          // optional, defaults to 'default'
  "channel":        "whatsapp",         // required; stored on the conversation
  "visitorId":      "wa_<contactId>",   // caller-owned stable identity
  "conversationId": null,               // null or absent = resolve/create
  "requestId":      "<idempotency key>",
  "message":        "customer text",
  "locale":         "en",               // optional
  "metadata":       { "phone": "+60...", "displayName": "Ana" }
}
```

Response `200`:

```jsonc
{
  "schemaVersion":   1,
  "conversationId":  "uuid",
  "messageId":       "uuid",            // the assistant message
  "requestId":       "...",
  "duplicate":       false,
  "text":            "the reply",
  "intent":          "product_question",
  "confidence":      0.82,
  "handoffRequired": false,
  "sources":         [{ "id": "...", "title": "...", "snippet": "..." }],
  "usage":           { "inputTokens": 812, "outputTokens": 96,
                       "model": "gpt-4o-mini", "provider": "openai" },
  "latencyMs":       1840
}
```

### Status codes

| Code | Meaning | Caller's move |
|---|---|---|
| `200` | Answered, or a duplicate replayed | Send `text` |
| `400` | Malformed body | Fix and do not retry |
| `401` | Bad or missing service token | Alert; do not retry |
| `404` | `conversationId` unknown, or not owned by this `(tenantId, visitorId)` | Retry once with `conversationId: null` |
| `409` | A generation is already running on this conversation | Back off; do not double-send |
| `413` | Message exceeds `maxMessageCharacters` | Truncate and retry |
| `429` | Rate limited | Honour `retryAfterSeconds` |
| `502` | LLM or Open Notebook failed | Retryable |
| `504` | Pipeline exceeded the server deadline | Retryable, same `requestId` |

Reuse `GatewayErrorCode` for the body so both transports name failures
identically.

---

## Work items

### 1. Configuration — the service token

Add to `src/config/settings.schema.ts` and `buildConfiguration`, following the
existing shape (`key` is both the env var and the settings.json key):

| Key | Type | Tier | Notes |
|---|---|---|---|
| `SERVICE_API_TOKEN` | `secret` | `runtime` | Shared secret for server-to-server callers |
| `SERVICE_API_ENABLED` | `boolean` | `runtime` | Default `false` — the surface is opt-in |
| `SERVICE_REPLY_TIMEOUT_MS` | `number` | `runtime` | Server-side deadline, default `45000` |

`tier: 'runtime'` is correct and load-bearing: the schema's own doc comment
warns that getting the tier wrong tells an operator a change landed when it did
not. These are all read per call.

Boot validation should require `SERVICE_API_TOKEN` in production **when**
`SERVICE_API_ENABLED` is true, mirroring how `PORTAL_TOKEN` is handled.

### 2. `ServiceTokenGuard`

New guard in `src/auth/`, modelled directly on `PortalTokenGuard`:

- Compare with `timingSafeEqual`, as the portal guard already does.
- Reject with `UnauthorizedException` when the feature is disabled, so a
  deployment that never turns it on presents no surface at all.
- **Do not accept the portal session cookie.** The portal credential is an
  operator's browser identity; this is a machine identity. Keeping them separate
  means revoking one does not revoke the other.
- **Do not accept `PORTAL_TOKEN`.** It opens the configuration API, which can
  repoint the gateway at another LLM. A chat integration must not hold that.

### 3. Make the pipeline return its result

`OrchestrationService.runChatSend` already computes everything the response
needs — `assistantMessage`, `intent`, `intentResult.confidence`,
`escalation.required` and `usage` — and then emits them in `chat:complete`.

Refactor so the private pipeline **returns** a `ChatTurnResult`, and the
WebSocket path emits from that return value. One pipeline, two presentations:

```
runChatSend(context, dto): Promise<ChatTurnResult>
  ├─ handleChatSend(...)  → emits chat:* events   (unchanged behaviour)
  └─ replyOnce(...)       → returns ChatTurnResult (new)
```

Streaming still happens internally — `response-stream.service` is unchanged.
The REST path simply awaits the accumulated text instead of forwarding deltas.
Keep the emitter calls in the WebSocket wrapper only, so a REST call does not
broadcast into a room nobody is listening to.

> **Invariant to preserve:** the activity records, citation trimming and
> escalation evaluation must run identically on both paths. A regression test
> should assert that the same input produces the same `ChatTurnResult` whether
> it arrived by socket or by HTTP.

### 4. Fix duplicate handling — the one real behaviour change

Today a duplicate `requestId` logs and returns:

```ts
if (duplicate) {
  this.logger.log(`Ignoring duplicate chat:send request=${requestId}`);
  return;
}
```

For a widget that is correct — the client already has the answer on screen. For
a REST caller **a retry would get an empty reply**, which is exactly what a
retry must not do.

Change the shared path to: on a duplicate, load the assistant message already
stored for that `requestId` and return it with `duplicate: true`. If the
original generation is still running, return `409` rather than starting a
second one. `MessageService` already queries by
`{ conversationId, requestId, role }`, so the lookup exists.

This is the single most important item in this plan. Without it, at-least-once
delivery on the caller's side produces silent dropped replies.

### 5. Server-to-server conversation resolve

`ConversationService.resolveForVisitor` is close, but the caller supplies the
identity rather than receiving one. Add a sibling that:

- takes `(tenantId, visitorId, channel, conversationId?, metadata?)`
- reuses the existing ownership and `status !== CLOSED` checks
- passes `channel` into `create()` instead of the hardcoded literal
- merges caller `metadata` into the conversation's `jsonb` column

`AiConversation.channel` **already exists** as a column with a `'web_widget'`
default. Only the object literal in `ConversationService.create` hardcodes it:

```ts
channel: 'web_widget',   // ← becomes: channel: input.channel ?? 'web_widget'
```

So this is a code change, not a migration. Every existing row keeps its value.

Add an index on `(tenant_id, channel)` if the portal will filter by channel.

### 6. Message length

`ChatSendDto` caps `message` at 2000 characters, and `RateLimitService` enforces
`maxMessageCharacters` separately. A batching caller will send joined bursts and
will hit this.

Decide one and document it: either raise the cap for service callers, or return
`413` with the limit in the body so the caller can truncate deterministically.
**Do not silently truncate server-side** — the customer's words disappearing
without either side knowing is the worst of the three outcomes.

### 7. Operator write-back (`MessageRole.AGENT`)

`MessageRole` already declares `AGENT` alongside `USER`, `ASSISTANT` and
`SYSTEM`, and nothing writes it yet. It is the reserved slot for a human
operator's message — the mirror of `handler_type = 'external_agent'` sitting
unused in wa-chat-flow.

```
POST /api/v1/agent/conversations/:id/agent-message
{ "requestId": "...", "text": "...", "operatorRef": "..." }
```

Persists with `role: MessageRole.AGENT` and touches the conversation. No
generation, no LLM call.

**Why this is not optional.** The gateway owns conversation memory. When an
operator takes a WhatsApp thread over and answers by hand, the gateway never
learns, and its next answer re-answers a question a person already handled —
precisely in the moment a human stepped in because the AI was struggling. This
endpoint is how that history stays true.

Confirm `PromptService` includes `AGENT` turns when building context. If it
filters to `USER`/`ASSISTANT`, widen it, or the write-back is stored and ignored.

### 8. Handoff signal

`escalation.required` is already computed and already published as
`handoffRequired` on `chat:complete`. Carry it on the REST response unchanged.

`HandoffService.requestHandoff` persists but sends no outbound notification —
handoffs are pulled by the portal. That stays true; the response field is what
lets a caller react in real time without polling.

### 9. Health

Extend `GET /api/v1/ai-support/health` (or add `/api/v1/agent/health`) to report
whether the service API is enabled and configured, so an integration can check
its dependency without holding a token for the configuration API.

---

## Testing

| Level | What |
|---|---|
| Unit | `ServiceTokenGuard`: valid, invalid, missing, disabled; constant-time compare |
| Unit | Duplicate `requestId` returns the stored answer, not an empty body |
| Unit | `channel` reaches the persisted row; absent input still yields `web_widget` |
| Integration | Socket and REST produce an equivalent `ChatTurnResult` for one input |
| Integration | Concurrent same-conversation calls: one answers, one gets `409` |
| Integration | Oversized message returns `413` with the limit |
| Integration | `AGENT` write-back appears in the next turn's prompt context |
| Contract | A recorded fixture Plan 2 can replay without a live gateway |

Keep the existing assertion that answer providers touch no repository. This plan
must not weaken it.

---

## Sequencing

| Step | Item | Blocks Plan 2? |
|---|---|---|
| 1 | Config keys + `ServiceTokenGuard` (§1, §2) | Yes |
| 2 | Return-value refactor (§3) | Yes |
| 3 | Duplicate replay (§4) | Yes |
| 4 | Conversation resolve + channel (§5) | Yes |
| 5 | `POST /agent/reply` wiring + errors | Yes |
| 6 | Message length decision (§6) | Yes — Plan 2 needs the number |
| 7 | Health (§9) | No |
| 8 | Operator write-back (§7) | No — Plan 2 Phase 4 |

Steps 1–6 are the minimum Plan 2 can build against. Publish the OpenAPI page
(`/docs`) and a recorded fixture at that point; Plan 2 stops being blocked there
even if 7–8 are still open.

## Operational note — answer provider choice

The README measures `ask-compose` at roughly 12s to first token (three model
calls in series) against roughly 1.8s for `gateway-rag`. A chat channel cares
about time to the *complete* answer, not first token, so `ask-compose` will
regularly exceed 20s end to end.

That is survivable but it shapes Plan 2's timeout and typing-indicator work. If
both channels must run from one deployment and WhatsApp needs `gateway-rag`
while the web widget wants `ask-compose`, per-channel provider selection is a
follow-up — deliberately out of scope here.
