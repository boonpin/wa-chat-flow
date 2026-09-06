# Getting Started

## What This System Does

WA Robot connects your WhatsApp numbers to AI bots so incoming messages can
receive automatic AI replies — and gives your team a shared inbox to step in
whenever a human should take over.

WhatsApp connectivity runs through **WAHA**, a gateway service deployed
alongside the app. It must be running before you can connect a number.

## Main Modules

Navigation is grouped by how often you need it.

**Work** — the daily destinations:

- `Overview`: what needs attention, and what the AI will do next
- `Inbox`: read every conversation, reply, and choose who answers each one
- `Contacts`: per-customer reply mode and default bot

**Automation** — how replies are produced:

- `AI bots`: the instructions the AI answers with, and the tools it may use
- `Tools`: collect customer details mid-conversation into a Google Sheet
- `Reply settings`: whether the AI may answer at all, and the default bot
- `Campaigns`: send one deliberate message to a group of customers

**WhatsApp**

- `WhatsApp channels`: connect, repair and remove the numbers your business uses

**Utility**

- `Activity`: everything sent, received and captured, with per-event detail
- `Settings`: where each piece of configuration lives, plus access help
- `Help`: short guides for the tasks people actually do

## Access URL

- App URL: `http://localhost:3000`
- Login page: `http://localhost:3000/login`

## First-Time Checklist

1. Log in as admin (see [Login and Access](./02-login-and-access.md) — there are
   no default credentials).
2. Create at least one bot in `Bots`.
3. Set a default bot in `Settings`.
4. Turn on global auto reply in `Settings`.
5. Add and connect a number in `WhatsApp`.
6. Send yourself a test message and watch it land in `Inbox`.

