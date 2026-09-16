# Solution Architecture — Chat Channel · AI Agent · DCIM Hub

Top-level view of the whole solution: what each system owns, how it deploys,
what it needs configured, and the order to bring it up.

Detailed work plans live alongside this document:

- [Plan 1 — gateway service API](./01-gateway-service-api.md)
- [Plan 2 — WA Chat Flow integration](./02-wa-chat-flow-integration.md)
- DCIM Hub integration — scoped, not yet written up

---

## 1. The system

```
   ┌─────────┐
   │WhatsApp │  external
   └────┬────┘
        │ WhatsApp Web protocol
╔═══════▼═══════════════════════════════════════════════════════════════╗
║ EDGE                                                                  ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │ WAHA                        own Compose project · own lifecycle │  ║
║  │ Chromium session · REST + webhook emitter          [Chromium FS]│  ║
║  └────────────────────────────┬────────────────────────────────────┘  ║
╚═══════════════════════════════│═══════════════════════════════════════╝
                                │ webhook, HMAC-signed
╔═══════════════════════════════▼═══════════════════════════════════════╗
║ CHANNEL                                                               ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │ WA CHAT FLOW                              Next.js 16 · SQLite   │  ║
║  │ dedupe · contacts · threads · burst timing · Inbox · Logs       │  ║
║  │ owns: who said what, when, and whether a human took over        │  ║
║  └────────────────────────────┬────────────────────────────────────┘  ║
╚═══════════════════════════════│═══════════════════════════════════════╝
                                │ POST /agent/reply      service token
╔═══════════════════════════════▼═══════════════════════════════════════╗
║ BRAIN                          private network                        ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │ AI AGENT RUNTIME GATEWAY        NestJS · PostgreSQL · Redis     │  ║
║  │ persona · safety · agent memory · retrieval · TOOL LOOP (new)   │  ║
║  │ owns: what the assistant is and how it answers                  │  ║
║  └───────┬─────────────────┬──────────────────────┬────────────────┘  ║
║          │                 │                      │ client key        ║
║  ┌───────▼──────┐   ┌──────▼───────┐   ┌──────────▼─────────────────┐ ║
║  │OPEN NOTEBOOK │   │ LLM PROVIDER │   │ DCIM HUB CORE              │ ║
║  │knowledge base│   │   (egress)   │   │ NestJS · PG+TimescaleDB    │ ║
║  │  documents   │   │              │   │ /external/mcp/tools/*      │ ║
║  └──────────────┘   └──────────────┘   │ owns: live infra truth+RBAC│ ║
║                                        └────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### Request path

```
customer message
  → WAHA webhook
  → WA Chat Flow      persist, dedupe, open/extend the burst window
  → (window elapses)  one reply answers the whole burst
  → Gateway           persona + memory + retrieval, decides whether a tool is needed
      → Open Notebook   documents
      → DCIM Hub        live readings, alarms, rack status
  → Gateway           composes the answer in the assistant's voice
  → WA Chat Flow      writes the row, sends via WAHA
  → customer
```

---

## 2. Who owns what

| System | Owns | Never owns |
|---|---|---|
| **WAHA** | The WhatsApp session | Any business logic |
| **WA Chat Flow** | The channel — threads, dedupe, burst timing, human takeover | The assistant's behaviour |
| **Gateway** | The assistant — persona, safety, memory, which tool to call | Infrastructure truth |
| **DCIM Hub** | Live infra data, RBAC, tool execution, audit | The conversation |
| **Open Notebook** | Documents and retrieval | Anything live |

The rule that keeps this clean: **each system is the only one that knows its own
domain.** DCIM Hub answers *what the temperature is*; the gateway decides
*whether to say it, and how*. Neither reaches into the other.

### A note on the second orchestrator

DCIM Hub has its own agent runtime (`src/modules/mcp/`) — planner, executor,
LangChain, a 15-tool registry and a chat endpoint for the DCIM web UI.

**It is not in the WhatsApp path.** It emits UI actions, dashboards and
floorplans that a chat channel cannot render, and running two planners in series
would roughly double latency. DCIM Hub contributes *tools*; the gateway does the
orchestrating. The MCP agent continues to serve the DCIM UI unchanged.

---

## 3. Deployment topology

Four independently deployable units, three data stores. No new runtime
technology is introduced — no queue, no service mesh, no new database engine.

| Unit | Stack | Store | Exposure |
|---|---|---|---|
| WAHA | Docker Compose | Chromium profile on disk | Edge, outbound to WhatsApp |
| WA Chat Flow | Next.js standalone | SQLite file | Edge, receives webhooks |
| Gateway | NestJS container | PostgreSQL + Redis | **Private only** |
| DCIM Hub | NestJS container | PostgreSQL + TimescaleDB + Redis | **Private only** |

Two hard rules:

- **The gateway is never public.** It holds the LLM key and the DCIM client key.
  Only WA Chat Flow reaches it.
- **`/external/mcp` is private too.** Only the gateway calls it.

> **Current state:** `/external/mcp` is declared `@Public()` with a hardcoded
> agent context and no permission check. Closing that is the first task of the
> DCIM workstream, and is worth doing regardless of this project.

---

## 4. Configuration

### The credential chain

Each hop has its own secret. Nothing is shared end to end, so any one
credential can be rotated alone.

```
WA Chat Flow ──WAHA_API_KEY───────────────► WAHA
WAHA         ──WAHA_WEBHOOK_HMAC_KEY──────► WA Chat Flow
WA Chat Flow ──AGENT_RUNTIME_SERVICE_TOKEN► Gateway          (Plan 1)
Gateway      ──DCIM_MCP_CLIENT_KEY────────► DCIM Hub         (new)
Gateway      ──LLM_API_KEY────────────────► LLM provider
Gateway      ──OPEN_NOTEBOOK_PASSWORD─────► Open Notebook
```

### Where each system reads config

| System | Single read point |
|---|---|
| WA Chat Flow | `lib/config.ts` |
| Gateway | `settings.schema.ts`, plus a settings file that wins over env |
| DCIM Hub | `.env` |

The gateway's settings file is editable at `/portal/configuration`; first-run
setup is at `/portal/init`.

### The two switches that define the mode

| Switch | Effect when set |
|---|---|
| `AGENT_RUNTIME_URL` (WA Chat Flow) | Local AI Bot surfaces disappear; replies come from the gateway |
| `DCIM_MCP_URL` + client key (Gateway) | DCIM tools become available to the assistant |

Unset either and that layer simply is not there. **No code path changes — it is
a deployment fact, not a runtime toggle.**

---

## 5. The part configuration cannot express

The credential chain authenticates **systems**. It says nothing about **people**.

A WhatsApp contact is a phone number. DCIM Hub is multi-tenant, with per-user
roles and `UserScope` rows scoping people to individual sites and racks. Its
`AgentContext` requires a real `userId`, `tenantId` and `permissions[]`.

So there is a fifth piece of configuration that is not a secret: a **binding
table** mapping a contact to a DCIM principal.

| Contact state | Gets |
|---|---|
| Unbound | Knowledge base answers only |
| Bound | Live DCIM data, at that principal's own permission level |

**This binding is the security boundary of the whole solution.** Everything else
is plumbing. It needs a verified enrollment path, propagation across all three
systems, revocation, and a clear refusal for unbound contacts.

---

## 6. Bring-up order

Dependencies first, channel last:

| # | Step | Verify with |
|---|---|---|
| 1 | **DCIM Hub** — secure `/external/mcp`, create the MCP client | `curl` a monitoring tool |
| 2 | **Open Notebook + LLM** — ingest content, note model ids | Gateway's model dropdown |
| 3 | **Gateway** — point at all three | `/portal/init`, `/api/v1/ai-support/health` |
| 4 | **WA Chat Flow** — set `AGENT_RUNTIME_URL` | AI Bot surfaces gone; webhook replay |
| 5 | **WAHA** — scan the QR | A real message |

Each step is testable on its own — DCIM tools by `curl`, the gateway through its
own widget at `/widget/chat`, WA Chat Flow by replaying a webhook. **You never
debug four systems at once**, which is the main reason for this order.

### Rollback

Per-layer, and each is a configuration change rather than a deploy:

| Remove | Falls back to |
|---|---|
| `DCIM_MCP_URL` | Knowledge-base answers only |
| `AGENT_RUNTIME_URL` | Local AI bots in WA Chat Flow |
| Both | The system as it runs today |

---

## 7. Effort at a glance

Assuming Plan 1 and Plan 2 have shipped, the DCIM leg is:

| | Workstream | Repo | Effort |
|---|---|---|---|
| A | Secure the external MCP surface | DCIM Hub | 3w |
| B | Identity binding + enrollment | all three | 4w |
| C | Tool calling in the gateway | Gateway | 6w |
| D | Channel surface | WA Chat Flow | 2w |
| E | Security review, latency, rollout | — | 2w |
| | | | **~17w** |

Roughly 2–2.5 months with two or three engineers, since A and C parallelise
across repositories. B is the critical path — it touches all three.

**Two items drive most of that effort.** The gateway has no tool-calling
capability at all today (its answer providers are pure retrieval-and-compose),
and the identity binding in §5 has to be designed from scratch.

### A cheaper first version

A read-only MVP lands in **6–8 weeks**:

- Monitoring and analysis tools only — the eight already marked
  `isExternalAllowed`. No writes, so no confirmation flow
- Admin-provisioned bindings only — no self-service enrollment
- One tenant
- Workstream A still done in full; it is a prerequisite and a live exposure

That proves the chain end to end and defers the expensive, decision-heavy parts
until there is real usage to design against.
