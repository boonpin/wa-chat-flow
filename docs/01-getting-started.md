# Getting Started

## What This System Does

WA Robot connects your WhatsApp numbers to AI bots so incoming messages can
receive automatic AI replies — and gives your team a shared inbox to step in
whenever a human should take over.

WhatsApp connectivity runs through **WAHA**, a gateway service deployed
alongside the app. It must be running before you can connect a number.

## Main Modules

- `Overview`: health and quick status
- `WhatsApp`: connect/disconnect WhatsApp numbers
- `Inbox`: read every conversation, reply manually, toggle AI per thread
- `Bots`: create and manage AI bots
- `Blast`: send a templated message to many recipients
- `Contacts`: control per-contact AI behavior
- `Logs`: raw feed of everything sent and received
- `Settings`: global auto-reply and default bot

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

