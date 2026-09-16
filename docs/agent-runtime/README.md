# Agent Runtime Integration

Replacing WA Chat Flow's local AI Bot with the
[AI Agent Runtime Gateway](../../../ai-agent-runtime-gateway/) — a NestJS service
with agent orchestration and an Open Notebook knowledge base.

Start with the [solution architecture](./00-solution-architecture.md) for the
top-level view — what each system owns, how it deploys, what it needs
configured, and the order to bring it up.

Then two plans, two repositories, in order:

| | Document | Repository | Blocks |
|---|---|---|---|
| 0 | [Solution architecture](./00-solution-architecture.md) | all | — |
| 1 | [Server-to-server reply API](./01-gateway-service-api.md) | `ai-agent-runtime-gateway` | Plan 2 Phase 1 |
| 2 | [WA Chat Flow integration](./02-wa-chat-flow-integration.md) | `wa-chat-flow` | — |

A third leg — connecting the agent to **DCIM Hub** for live infrastructure
data — is scoped in §5–§7 of the architecture document but not yet written up as
its own plan.

## Why two plans

The gateway's only message-sending surface is a Socket.IO namespace built for a
browser widget: generation is detached (`Promise<void>`, results arrive as
events), a socket is bound to one conversation, and authentication issues
anonymous visitor tokens. WA Chat Flow needs `reply(input) => Promise<AIOutput>`
— one authenticated HTTP call, one answer.

Plan 1 adds that endpoint. Plan 2 consumes it.

Plan 1 steps 1–6 are the minimum Plan 2 can build against; publish the OpenAPI
page and a recorded fixture at that point and Plan 2 is unblocked.

## The shape of the result

```
WhatsApp → WAHA → webhook → WA Chat Flow → Gateway → Open Notebook + LLM
                                 ↑                          │
                                 └───────── reply ──────────┘
```

Turned on by a single deployment variable. With `AGENT_RUNTIME_URL` unset,
nothing in either plan changes how WA Chat Flow behaves today.

## Decisions taken

- **The gateway owns the agent's memory.** WA Chat Flow sends only the
  unanswered burst and keeps a pointer to the gateway's thread. `buildContext`
  is unchanged and still decides what to send.
- **A deployment gate, not a per-bot toggle.** In external mode the AI bots, AI
  providers and Tools surfaces are removed, not merely bypassed.
- **One system bot row survives** as an identity anchor, so `selectBot`, the Logs
  joins and `ai_usage` keep working. It is owned by the system: not creatable,
  editable or deletable by an operator, and **no tools may ever attach to it** —
  the gateway has its own tool calling, and a second local schema would let a
  capture fire twice with neither side aware of the other.
- **No fallback to a local bot** when the gateway is down. A visible failure in
  the thread beats an answer in the wrong voice with no knowledge base.

## Decisions still open

1. Which lead store wins — the gateway's PostgreSQL, or Apps Script → Sheets?
   Plan 2 removes the local one entirely in external mode, so if the Sheet is
   what the business works from, an inbound tool-callback endpoint is required.
   **Settle before Plan 2 Phase 1**, since the no-tools rule now lands there.
2. `gateway-rag` (~1.8s) or `ask-compose` (~12s to first token) for WhatsApp?
3. One tenant per deployment, or one per WhatsApp session?
