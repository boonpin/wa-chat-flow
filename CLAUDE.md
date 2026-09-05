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
- **WAHA** (WhatsApp HTTP API) as the WhatsApp transport, in its own container

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

### Key modules

- [lib/config.ts](lib/config.ts) — every environment variable, read in one place. Don't read `process.env` elsewhere.
- [lib/wa/](lib/wa/) — `types.ts` (transport contracts), `waha-provider.ts`, `normalize.ts` (webhook payload → internal shape), `sessions.ts` (session records + live status), `phone.ts`
- [lib/messaging/incoming-handler.ts](lib/messaging/incoming-handler.ts) — **the single entry point for every inbound message.** Split into `persistIncomingMessage` (synchronous, must finish before the webhook acks) and `runAutoReply` (async, runs after).
- [lib/messaging/outgoing.ts](lib/messaging/outgoing.ts) — all outbound sends; writes the row before sending so failures stay visible
- [lib/conversation/service.ts](lib/conversation/service.ts) — threads, modes, statuses, the Inbox queries
- [lib/ai/context.ts](lib/ai/context.ts) — conversation memory (last 20 text messages)
- [lib/db/index.ts](lib/db/index.ts) — pragmas, legacy baseline, migrations, default seeding
- [lib/db/legacy.ts](lib/db/legacy.ts) — one-time in-place upgrade for pre-Drizzle databases
- [app/api/webhooks/waha/route.ts](app/api/webhooks/waha/route.ts) — HMAC-verified, deliberately thin; no AI logic here
- [proxy.ts](proxy.ts) — cookie auth for everything except `/api/webhooks/`

### Data model

`contacts → conversations → messages`. A contact has at most one **open**
conversation; resolving it and receiving another message starts a new one.

- `conversations.mode` — `auto` (AI replies) or `human` (operator handles it)
- `conversations.status` — `open` or `resolved`
- `messages.sender_type` — `customer` | `ai` | `human` | `system`
- `messages.status` — `received` | `processing` | `sent` | `failed`
- Unique index on `(provider, provider_message_id)` is the deduplication guard —
  webhook delivery is at-least-once, so **never remove it**.

`contacts.aiEnabled` is the *default* mode for new conversations. Both the Inbox
mode toggle and the Contacts toggle write to both levels, so the two stay in sync.

## Conventions

- Schema changes: edit `lib/db/schema.ts`, then `pnpm db:generate`. Never add raw `CREATE TABLE` / `ALTER TABLE` to startup code.
- API routes whitelist request fields explicitly; never spread a request body into a DB update.
- Bot API keys are never returned to the client — `GET /api/bots` sends `hasApiKey: boolean`, and an empty `apiKey` on write means "keep the stored one".
- No secrets or default credentials in code. Runtime state (`storage/`, `*.db`) is gitignored.
