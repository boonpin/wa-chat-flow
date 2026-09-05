# Inbox

The Inbox is the main operational screen. Every WhatsApp thread appears here,
whether the AI or a human is handling it.

## Layout

- **Left:** conversation list, filtered by **Open** / **Resolved** / **All**,
  with search by name or phone number.
- **Right:** the selected thread, its controls, and the reply box.

## Who said what

| Bubble | Meaning |
| ------ | ------- |
| White, left | The customer |
| Green outline, labelled `AI` | An automatic AI reply |
| Solid green, labelled `You` | A manual reply from an operator |
| Red | A message that failed to send, with the reason |
| Red pill, centred | A system note, e.g. the AI provider was unreachable |

## AI Auto Reply toggle

Each conversation is in one of two modes:

- **ON** (`auto`) — the AI answers incoming messages
- **OFF** (`human`) — messages are stored but nothing is sent automatically

Turning the toggle also sets the default for that contact's future
conversations, so taking a customer off the AI stays in effect.

> The global switch in `Settings` still applies. If global auto reply is off,
> no conversation replies automatically regardless of its mode.

## Bot

Pick which bot answers this conversation, or leave it on **System default**.
Disabled bots are shown but cannot be selected.

## Manual reply

Type in the box and press **Enter** to send (Shift+Enter for a new line). The
message goes out through the same WhatsApp number the conversation arrived on.
If it fails, it stays in the thread marked `failed` with the error.

## Resolve

**Resolve** closes the thread and moves it to the Resolved tab. If the customer
writes again, a new conversation opens automatically, inheriting the contact's
AI mode and bot.
