Below is a **`SKILL.md`** designed for implementation by developers or AI coding agents.
It fits your stack (**NextJS + Tailwind + SQLite + Drizzle + whatsapp-web.js**) and focuses on **a minimal but extensible WhatsApp AI Auto Reply system**.

---

# SKILL.md

## WhatsApp AI Auto Reply System

## 1. Overview

The **WA Auto Reply System** is a backoffice application that allows administrators to configure AI bots to automatically respond to incoming WhatsApp messages.

The system integrates:

* **WhatsApp Web Client** using `whatsapp-web.js`
* **AI Providers** (OpenAI / Gemini)
* **Bot Configuration**
* **Contact Management**
* **Auto Reply Control**

The goal is to provide a **simple AI-driven auto reply system** where WhatsApp messages are handled by configurable AI bots.

---

# 2. Technology Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Frontend        | NextJS (App Router)     |
| UI              | TailwindCSS             |
| Backend API     | NextJS API Routes       |
| Database        | SQLite                  |
| ORM             | Drizzle ORM             |
| WhatsApp Client | whatsapp-web.js         |
| AI Providers    | OpenAI API / Gemini API |
| Auth            | Simple session / JWT    |

---

# 3. System Architecture

```
User
 │
 │
Backoffice UI (NextJS + Tailwind)
 │
 │ REST API
 │
NextJS Server
 │
 ├── Auth Module
 ├── Bot Module
 ├── WhatsApp Module
 ├── Contacts Module
 ├── AI Engine Module
 │
 ├── WhatsApp Client (whatsapp-web.js)
 │
 └── SQLite Database (Drizzle ORM)
```

---

# 4. Core Modules

## 4.1 Authentication Module

Allows admin user login to the backoffice system.

### Features

* Login
* Logout
* Session validation

### Table

```
users
```

| field         | type     |
| ------------- | -------- |
| id            | uuid     |
| email         | text     |
| password_hash | text     |
| created_at    | datetime |

---

# 4.2 AI Bot Management

Users can create multiple AI bots.

Each bot defines:

* AI Provider
* API Key
* Prompt Template

Only **one bot can be default**.

### Table

```
ai_bots
```

| field      | type                 |
| ---------- | -------------------- |
| id         | uuid                 |
| name       | text                 |
| provider   | enum(openai, gemini) |
| api_key    | text                 |
| model      | text                 |
| prompt     | text                 |
| is_default | boolean              |
| created_at | datetime             |
| updated_at | datetime             |

### Notes

`prompt` will act as the **system prompt**.

Example:

```
You are a helpful WhatsApp assistant.
Answer short and clear.
If user asks about pricing tell them to contact sales.
```

---

# 4.3 WhatsApp Configuration

System integrates with **whatsapp-web.js**.

The admin must scan QR code to login.

### Status Types

| status     |
| ---------- |
| offline    |
| waiting_qr |
| connected  |

### Table

```
wa_sessions
```

| field             | type     |
| ----------------- | -------- |
| id                | uuid     |
| session_name      | text     |
| status            | text     |
| last_connected_at | datetime |

---

### Required Features

1️⃣ Check session status

API

```
GET /api/wa/status
```

Response

```
connected
waiting_qr
offline
```

---

2️⃣ Generate QR Code

```
GET /api/wa/qr
```

Return QR image.

---

3️⃣ Logout Session

```
POST /api/wa/logout
```

---

### WhatsApp Client Boot

When server starts:

```
initWhatsappClient()
```

Behavior:

```
if session exists
  restore session
else
  generate QR
```

---

# 4.4 Contact Management

System automatically stores WhatsApp contacts that message the system.

### Table

```
contacts
```

| field        | type     |
| ------------ | -------- |
| id           | uuid     |
| phone_number | text     |
| name         | text     |
| ai_enabled   | boolean  |
| ai_bot_id    | uuid     |
| created_at   | datetime |
| updated_at   | datetime |

### Behavior

If new message received:

```
if contact not exist
  create contact
```

Admin can configure:

* Enable AI reply
* Assign bot

---

# 4.5 System Settings

Global system configuration.

### Table

```
system_settings
```

| field              | type    |
| ------------------ | ------- |
| id                 | uuid    |
| auto_reply_enabled | boolean |
| default_bot_id     | uuid    |

---

# 5. WhatsApp Message Flow

### Incoming Message

```
User send message
        │
        ▼
whatsapp-web.js receive message
        │
        ▼
Save contact
        │
        ▼
Check system auto_reply_enabled
        │
        ├─ NO → ignore
        │
        ▼
Check contact.ai_enabled
        │
        ├─ NO → ignore
        │
        ▼
Select bot
        │
        ├─ contact assigned bot
        └─ default bot
        │
        ▼
Send message to AI provider
        │
        ▼
Generate response
        │
        ▼
Send reply via WhatsApp
```

---

# 6. AI Engine Module

Responsible for communicating with AI providers.

Supported providers:

* OpenAI
* Gemini

### Interface

```
generateAIReply(bot, message)
```

Parameters

```
bot
message
```

Returns

```
string response
```

---

### OpenAI Example

```
POST https://api.openai.com/v1/chat/completions
```

Payload

```
system: bot.prompt
user: incoming message
```

---

### Gemini Example

```
POST https://generativelanguage.googleapis.com
```

---

# 7. WhatsApp Listener

Main listener.

```
client.on("message", async (msg) => {

   const phone = msg.from

   const contact = getOrCreateContact(phone)

   if (!system.autoReply) return

   if (!contact.aiEnabled) return

   const bot = getBot(contact)

   const reply = await aiEngine.generate(bot, msg.body)

   client.sendMessage(phone, reply)

})
```

---

# 8. Admin UI Pages

## Login Page

```
/login
```

Fields:

* Email
* Password

---

## Dashboard

```
/dashboard
```

Shows

* WhatsApp status
* Connected / Offline
* Total contacts

---

## WhatsApp Settings

```
/wa
```

Features:

* View status
* Show QR Code
* Logout

---

## AI Bot Management

```
/bots
```

Features:

* Create bot
* Edit bot
* Delete bot
* Set default bot

Fields:

* Name
* Provider
* API Key
* Model
* Prompt

---

## Contacts Management

```
/contacts
```

Features:

* Contact list
* Enable/Disable AI
* Assign AI bot

---

## System Settings

```
/settings
```

Features:

* Enable/Disable Auto Reply
* Set Default Bot

---

# 9. Minimal API List

| API                   | Purpose         |
| --------------------- | --------------- |
| POST /api/login       | login           |
| GET /api/wa/status    | whatsapp status |
| GET /api/wa/qr        | get QR code     |
| POST /api/wa/logout   | logout WA       |
| GET /api/bots         | list bots       |
| POST /api/bots        | create bot      |
| PUT /api/bots/:id     | update bot      |
| DELETE /api/bots/:id  | delete bot      |
| GET /api/contacts     | list contacts   |
| PUT /api/contacts/:id | update contact  |
| GET /api/settings     | system settings |
| PUT /api/settings     | update settings |

---

# 10. Message Logging (Optional)

For debugging.

Table

```
messages
```

| field      | type                    |
| ---------- | ----------------------- |
| id         | uuid                    |
| contact_id | uuid                    |
| direction  | enum(incoming,outgoing) |
| message    | text                    |
| created_at | datetime                |
