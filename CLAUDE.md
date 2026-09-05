# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm db:generate  # Generate a migration after editing lib/db/schema.ts
pnpm db:migrate   # Apply pending migrations without booting the app
pnpm seed         # Create/reset the admin account (needs ADMIN_EMAIL + ADMIN_PASSWORD)
pnpm backup       # Back up the SQLite DB and WAHA session storage
```

Package manager: **pnpm** (pnpm-lock.yaml present).

## Stack

- **Next.js 16** with App Router (`app/` directory), `output: 'standalone'`
- **React 19**
- **TypeScript** (strict mode, path alias `@/*` maps to project root)
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)
- **Better-SQLite3 + Drizzle ORM**, versioned SQL migrations in `drizzle/`
- **WAHA** (WhatsApp HTTP API) as the WhatsApp transport, deployed **separately**
  from `waha/` — its own Compose project, own `.env`, own lifecycle. The only
  shared secret is `WAHA_API_KEY`; see [waha/README.md](waha/README.md).

## Architecture

```
WhatsApp → WAHA → webhook → WA Chat Flow (Next.js + SQLite) → AI → WAHA → WhatsApp
```

Two deliberate seams, both of which exist so the pieces behind them can be
replaced without touching business logic:

- **`WhatsAppProvider`** (`lib/wa/provider.ts`) — the only abstraction over the
  messaging transport. `WahaProvider` is the sole implementation, and
  `lib/wa/waha-provider.ts` is the only file that knows WAHA's REST surface.
  **Never import `waha-provider` outside `lib/wa/`; call `getProvider()`.**
- **`AIHandler`** (`lib/ai/handler.ts`) — `DirectAIHandler` calls OpenAI/Gemini
  today; `handler_type = external_agent` is reserved for a future Agent Runtime.
- **`CaptureSink`** (`lib/tools/sinks/types.ts`) — where a captured row is
  written. `AppsScriptSink` is the sole implementation, and
  `lib/tools/sinks/apps-script.ts` is the only file that knows its wire format.
  **Never import a sink outside `lib/tools/`.**

### Key modules

- [lib/config.ts](lib/config.ts) — every environment variable, read in one place. Don't read `process.env` elsewhere.
- [lib/wa/](lib/wa/) — `types.ts` (transport contracts), `waha-provider.ts`, `normalize.ts` (webhook payload → internal shape), `sessions.ts` (session records + live status), `phone.ts`
- [lib/messaging/incoming-handler.ts](lib/messaging/incoming-handler.ts) — **the single entry point for every inbound message.** Split into `persistIncomingMessage` (synchronous, must finish before the webhook acks) and `runAutoReply` (async, runs after).
- [lib/messaging/outgoing.ts](lib/messaging/outgoing.ts) — all outbound sends; writes the row before sending so failures stay visible
- [lib/conversation/service.ts](lib/conversation/service.ts) — threads, modes, statuses, the Inbox queries
- [lib/ai/context.ts](lib/ai/context.ts) — conversation memory (last 20 text messages)
- [lib/ai/direct-handler.ts](lib/ai/direct-handler.ts) — LLM call **and the tool loop**; providers under `lib/ai/providers/` are dumb translators between `ProviderRequest` and each SDK's wire format
- [lib/tools/](lib/tools/) — `registry.ts` (config rows → the function schemas a model sees), `runner.ts` (execute one call), `sinks/` (where the row lands)
- [lib/db/index.ts](lib/db/index.ts) — pragmas, legacy baseline, migrations, default seeding
- [lib/db/legacy.ts](lib/db/legacy.ts) — one-time in-place upgrade for pre-Drizzle databases
- [app/api/messages/[id]/route.ts](app/api/messages/[id]/route.ts) — one log entry in full, resolving `messages.tool_invocation_id` into the capture behind a tool row; backs the Logs detail drawer
- [app/api/webhooks/waha/route.ts](app/api/webhooks/waha/route.ts) — HMAC-verified, deliberately thin; no AI logic here
- [proxy.ts](proxy.ts) — cookie auth for everything except `/api/webhooks/`

**No `instrumentation.ts`.** Next.js does not apply `outputFileTracingExcludes`
to the instrumentation entry, so importing the database layer there pulls the
entire project directory — including runtime state like WAHA's Chromium profile
— into the standalone build, which fails on broken symlinks. Session
reconciliation happens lazily instead, via `ensureSessionsReconciled()` in
[lib/wa/sessions.ts](lib/wa/sessions.ts). Do not reintroduce the hook.

### Data model

`contacts → conversations → messages`. A contact has at most one **open**
conversation; resolving it and receiving another message starts a new one.

- `conversations.mode` — `auto` (AI replies) or `human` (operator handles it)
- `conversations.status` — `open` or `resolved`
- `messages.sender_type` — `customer` | `ai` | `human` | `system`
- `messages.status` — `received` | `processing` | `sent` | `failed`
- `messages.message_type` — `text` | `image` | `audio` | `document` | `tool` | `unknown`.
  A `tool` row is the audit trail for one tool call; `buildHistory` filters on
  `text`, so it never re-enters the model's memory.
- Unique index on `(provider, provider_message_id)` is the deduplication guard —
  webhook delivery is at-least-once, so **never remove it**.

`contacts.aiEnabled` is the *default* mode for new conversations. Both the Inbox
mode toggle and the Contacts toggle write to both levels, so the two stay in sync.

`tools → bot_tools → ai_bots`. A tool's `fields` (JSON) drives three things at
once: the JSON Schema the model sees, the server-side validation, and the sheet
column order — so sales and support capture are two **rows**, not two code
paths. `tool_invocations` records every capture *before* the sink is called, so
a Google outage costs the sync and not the lead.

## Conventions

- Schema changes: edit `lib/db/schema.ts`, then `pnpm db:generate`. Never add raw `CREATE TABLE` / `ALTER TABLE` to startup code.
- API routes whitelist request fields explicitly; never spread a request body into a DB update.
- Bot API keys are never returned to the client — `GET /api/bots` sends `hasApiKey: boolean`, and an empty `apiKey` on write means "keep the stored one". A tool's `sinkUrl` and `sinkSecret` follow the same rule: together they are the credential that can write to the sheet.
- No secrets or default credentials in code. Runtime state (`storage/`, `waha/data/`, `*.db`) is gitignored.
- `waha/` is a separate deployment: never import from it, never assume it shares the app's `.env`, and keep app changes from requiring a gateway redeploy.
- WAHA has two independent auth systems — browser basic auth for its dashboard, `X-Api-Key` for its REST API. Dashboard access grants no API access.
- **Tool results are never thrown.** `executeTool` returns `{ ok: false, error }`
  for a missing field or an unreachable sink, because the model reads that
  result and reacts to it — asking the customer for the missing email is the
  whole point. Throwing would abort the reply instead. The loop is capped at
  `MAX_TOOL_ROUNDS`, and the final round runs with tools withdrawn.
- **A failed sheet write still returns `ok: true` to the model**, carrying
  `syncError` for the operator. The details are already on disk, so re-asking
  the customer would be the worse outcome. `recordToolRun` logs the row as
  `failed` even so — the model's view and the operator's view differ on purpose.
- **Inbound addresses:** one-to-one chats arrive as either `@c.us` (phone number) or `@lid` (linked identity — an opaque id, *not* a phone number). Both are real customers. A `@lid` is resolved to its phone via `provider.resolveLid()` before anything is stored; never treat its digits as a number. Groups (`@g.us`), channels (`@newsletter`) and `status@broadcast` are dropped.
