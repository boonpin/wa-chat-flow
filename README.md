# WhatsApp AI Handler

☕ Support this project: [Buy Me a Coffee](https://buymeacoffee.com/wongbpc)

WhatsApp AI Handler is a lightweight automation platform that connects **WhatsApp messaging with AI-powered responses**. It allows businesses to automatically respond to incoming WhatsApp messages using configurable AI providers such as **OpenAI** or **Google Gemini**.

The system provides a simple **web-based backoffice** where users can manage AI bots, configure prompts, connect WhatsApp sessions, and control how conversations are handled.

This tool is designed for businesses that want to **automate customer replies, support inquiries, and reduce manual messaging workload** while keeping full control over AI behavior.

---

# Features

## 🤖 AI Auto Reply
- Integrate with AI providers:
  - OpenAI
  - Google Gemini
- Custom system prompts for each AI bot
- Configure different response behaviors
- Automatic reply to incoming WhatsApp messages

## 📱 WhatsApp Integration
- Connect WhatsApp through **WAHA** (WhatsApp HTTP API), running as its own container
- QR code login, multiple numbers side by side
- Session status monitoring and automatic reconnection, handled by the gateway
- Swappable transport: business logic talks to a `WhatsAppProvider` interface, never to WAHA directly

## 🧠 Multiple AI Bots
- Create multiple AI bots
- Set **default bot** for auto replies
- Assign specific bots to specific contacts
- Enable or disable bots anytime

## 📥 Shared Inbox
- Every thread in one place, filtered by Open / Resolved
- Per-conversation **AI Auto Reply** toggle — hand a thread to a human at any time
- Operators reply manually alongside the AI, with delivery status on every message
- Conversation memory: the bot sees the last ~20 messages of the thread

## 👥 Contact Management
- Store incoming WhatsApp contacts
- Enable/disable AI response per contact
- Assign AI bot per contact
- View conversation history

## ⚙️ System Controls
- Global switch to enable/disable auto reply
- Manage WhatsApp session status
- Manage AI providers and API keys
- Configure prompt templates

---

# Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS 4
- **Database**: Better-SQLite3
- **ORM**: Drizzle ORM
- **WhatsApp Integration**: WAHA (WhatsApp HTTP API)
- **AI Providers**: OpenAI, Google Gemini
- **Deployment**: Docker Compose (app + WAHA on a single VPS)

---

# System Architecture

```
WhatsApp
   ↓
WAHA
   ↓ webhook / REST API
WA Chat Flow
   ├── Next.js
   ├── SQLite
   ├── Contacts
   ├── Conversations
   ├── Inbox
   ├── AI Handler
   │    ├── Direct LLM       ← now
   │    └── Agent Runtime    ← later
   └── WhatsApp Provider
        └── WAHA
```

Message flow:

```
WAHA webhook
↓
verify HMAC → normalize → handleIncomingMessage()
↓
deduplicate on provider_message_id
↓
find/create contact → find/create conversation → store message
↓
AUTO or HUMAN?
↓ (auto)
select bot → build context (last ~20 messages) → AI Handler
↓
WhatsAppProvider.sendText() → WAHA → WhatsApp
```

Responsibility split:

| Layer | Owns |
| ----- | ---- |
| **WAHA** | WhatsApp connectivity, QR/login, sessions, send/receive, reconnection |
| **WA Chat Flow** | Dashboard, contacts, conversations, messages, human inbox, AI routing, prompts |
| **Direct AI** | OpenAI / Gemini calls |
| **Agent Runtime** *(later)* | RAG, knowledge base, MCP, tools, advanced memory |

---

# Installation

## Production — Docker Compose (recommended)

The gateway and the application are **two independent deployments**. Bring the
gateway up first — it creates the network the app joins.

```bash
git clone git@github.com:boonpin/wa-chat-flow.git
cd wa-chat-flow

# 1. Gateway (see waha/README.md for details)
cd waha
cp .env.example .env       # WAHA_API_KEY, WAHA_DASHBOARD_PASSWORD
docker compose up -d
cd ..

# 2. Application
cp .env.example .env
# Fill in, at minimum:
#   JWT_SECRET              openssl rand -hex 32
#   WAHA_API_KEY            must MATCH waha/.env
#   WAHA_WEBHOOK_HMAC_KEY   openssl rand -hex 32
#   ADMIN_EMAIL / ADMIN_PASSWORD
#   APP_URL                 https://wa.example.com
#   WAHA_BASE_URL           http://waha:3000

docker compose up -d --build
```

```
Small VPS

waha/docker-compose.yml            docker-compose.yml
│                                  │
└── waha                           └── wa-chat-flow      published on :3000
    ├── 127.0.0.1:3001 only            ├── Next.js
    └── waha/data/*                    └── /storage/app/app.db
              └──────── shared docker network ────────┘
```

WAHA is deliberately **not** exposed to the internet — its API can send messages
from your number, so WA Chat Flow is the only public-facing service. Put a
reverse proxy (Caddy, nginx, Traefik) with TLS in front of port 3000.

Because the two are separate projects, you can restart, upgrade or relocate the
gateway without redeploying the app — only `WAHA_API_KEY` must match, and
`WAHA_BASE_URL` / `WAHA_WEBHOOK_URL` must point the right way.

## Local development

```bash
pnpm install
cp .env.example .env    # set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# Run the gateway from its own compose project:
cd waha && cp .env.example .env && docker compose up -d && cd ..

# Point the app at it (.env):
#   WAHA_BASE_URL=http://127.0.0.1:3001
#   WAHA_API_KEY=<same value as waha/.env>
#   WAHA_WEBHOOK_URL=http://host.docker.internal:3000/api/webhooks/waha

pnpm dev
```

> **Webhooks travel inward**, from the WAHA container to your app. Inside that
> container `localhost:3000` is WAHA itself, not your machine — which is why
> `WAHA_WEBHOOK_URL` must be `host.docker.internal` when the app runs on the
> host. Get this wrong and messages arrive on your phone but never in the app.

## Database

Migrations run automatically at startup. To apply them without booting the app:

```bash
pnpm db:migrate     # apply pending migrations
pnpm db:generate    # generate a new migration after editing lib/db/schema.ts
```

Upgrading from a pre-WAHA install: the first start detects the old schema,
converts it in place (messages are grouped into conversations, contacts keep
their AI settings) and stamps the migration history. **Back up
`storage/data/app.db` first.**

## Admin account

`ADMIN_EMAIL` / `ADMIN_PASSWORD` create the first user on initial startup only.
To create or reset an account later:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' pnpm seed
```

There are no default credentials — an unseeded install has no way in until you
set these.

---

# WhatsApp Setup

1. Open **WhatsApp** in the sidebar
2. **+ Add Number**, give it a name (e.g. Sales, Support)
3. Click **Connect** and scan the **QR Code** with WhatsApp → Linked Devices
4. The session lives in WAHA, so it survives app restarts and redeploys

If a session expires, click **Reconnect** and scan again.

---

# Backups

Back up the two things that cannot be rebuilt — the database and the WhatsApp
logins:

```bash
pnpm backup       # writes storage/backups/, keeps 7 days
```

The database is copied with SQLite's online backup API, so it is safe to run
against a live system. Schedule it from cron:

```
0 3 * * *  cd /srv/wa-chat-flow && pnpm backup >> storage/backups/backup.log 2>&1
```

---

# AI Bot Configuration

Each AI Bot includes:

| Field        | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| Name         | Bot name                                                            |
| Provider     | OpenAI / Gemini                                                     |
| API Key      | Optional — falls back to `OPENAI_API_KEY` / `GEMINI_API_KEY`        |
| Model        | Provider model id                                                   |
| Prompt       | System prompt; this is your business context                        |
| Handler type | `direct` today; `external_agent` when the Agent Runtime lands       |
| Enabled      | Disabled bots are never selected for auto replies                   |

Stored API keys are never sent back to the browser. Editing a bot leaves the key
field blank — submit it empty to keep the existing key.

Example prompt:

```
You are a helpful customer service assistant for a business.
Answer politely and clearly.
If you do not know the answer, ask the user to contact support.
```

---

# Contact AI Assignment

Contacts can be configured with:

* AI bot assignment
* AI auto-reply enable/disable
* Conversation history

Example:

| Phone        | AI Bot     | Auto Reply |
| ------------ | ---------- | ---------- |
| +60123456789 | SalesBot   | Enabled    |
| +60187654321 | SupportBot | Enabled    |

---

# Auto Reply Control

Two levels, both must be on for the AI to answer:

1. **Global switch** — `Settings → Auto Reply`. Off means messages are still
   received and stored, but nothing is sent.
2. **Per conversation** — the `AI Auto Reply` toggle in the Inbox. On is `auto`
   mode; off is `human` mode, where an operator handles the thread. The toggle
   also becomes that contact's default for future conversations.

---

# Folder Structure

```
wa-ai-handler
│
├── app                  # Next.js App Router (Pages, Layouts, API)
│   ├── (dashboard)      # Authenticated dashboard routes
│   ├── api              # Backend API routes
│   └── login            # Authentication pages
│
├── lib
│   ├── wa               # Transport: provider interface, WAHA client, normalizer
│   ├── messaging        # Incoming handler, outgoing sender, bot selection
│   ├── conversation     # Conversation/thread service
│   ├── contacts         # Contact upsert
│   ├── ai               # AIHandler abstraction, direct handler, providers
│   ├── blast            # Campaign engine and queue
│   ├── db               # Drizzle schema, migrations runner, legacy upgrade
│   └── config.ts        # All environment configuration, in one place
│
├── drizzle              # Generated SQL migrations (shipped in the image)
├── components           # Reusable UI components
├── public               # Static assets
├── scripts              # migrate / seed / backup
├── docker-compose.yml   # app + waha
└── README.md
```

---

# Future Improvements

* Agent Runtime handler (`handler_type = external_agent`)
* Knowledge base integration
* RAG (Retrieval Augmented Generation)
* Chat analytics dashboard
* Multi-tenant support
* WhatsApp message templates
* CRM integration

---

# Use Cases

* Customer support automation
* Sales inquiries auto-response
* FAQ answering
* Lead qualification
* Appointment booking

---

# License

MIT License

---

# Author

Built for businesses that want to integrate **AI-powered messaging automation** with WhatsApp while maintaining full control over AI behavior.