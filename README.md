# WhatsApp AI Handler

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
- Connect WhatsApp via **whatsapp-web.js**
- QR code login
- Session status monitoring
- Automatic reconnection handling

## 🧠 Multiple AI Bots
- Create multiple AI bots
- Set **default bot** for auto replies
- Assign specific bots to specific contacts
- Enable or disable bots anytime

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

Frontend:
- ReactJS
- Vite
- TailwindCSS

Backend:
- Node.js
- NestJS

Database:
- SQLite

ORM:
- Drizzle ORM

WhatsApp Integration:
- whatsapp-web.js

AI Providers:
- OpenAI
- Google Gemini

---

# System Architecture

```

User Message (WhatsApp)
↓
whatsapp-web.js Listener
↓
Backend Message Handler
↓
Check Contact Settings
↓
Select AI Bot
↓
Send Prompt + Message to AI Provider
↓
Receive AI Response
↓
Reply Message to WhatsApp User

````

---

# Installation

## 1. Clone Repository

```bash
git clone git@github.com:boonpin/wa-chat-flow.git
cd wa-ai-handler
````

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment

Create `.env` file:

```env
PORT=3000
DATABASE_URL=sqlite.db

OPENAI_API_KEY=
GEMINI_API_KEY=
```

## 4. Run Database Migration

```bash
npm run db:migrate
```

## 5. Start Backend

```bash
npm run start
```

## 6. Start Frontend

```bash
npm run dev
```

---

# WhatsApp Setup

1. Open the **WhatsApp configuration page**
2. Click **Connect WhatsApp**
3. Scan the **QR Code**
4. Once authenticated, the session will remain active

If the session expires, the system will request login again.

---

# AI Bot Configuration

Each AI Bot includes:

| Field    | Description                    |
| -------- | ------------------------------ |
| Name     | Bot name                       |
| Provider | OpenAI / Gemini                |
| API Key  | Provider API key               |
| Prompt   | System prompt used for replies |
| Enabled  | Enable or disable the bot      |

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

# Global Auto Reply Control

The system includes a **global switch**:

```
System Settings → Auto Reply
```

Options:

* ON → AI responds automatically
* OFF → Messages received but no auto reply

---

# Folder Structure

```
wa-ai-handler
│
├── backend
│   ├── modules
│   │   ├── whatsapp
│   │   ├── ai-bots
│   │   ├── contacts
│   │   └── system
│   │
│   ├── services
│   └── controllers
│
├── frontend
│   ├── pages
│   ├── components
│   └── containers
│
├── database
│   └── schema
│
└── README.md
```

---

# Future Improvements

* Conversation memory
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