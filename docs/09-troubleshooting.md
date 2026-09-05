# Troubleshooting

## Cannot Login

- There are no default credentials. Confirm `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  were set before first start, or create an account with
  `ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm seed`.
- Make sure the app is running on `http://localhost:3000` (or your `APP_URL`).
- In production, `JWT_SECRET` must be set. If it changed, everyone is signed out.

## WhatsApp Not Connecting

First check the gateway — most connection problems are WAHA, not the app:

```bash
docker compose ps        # is the waha container up and healthy?
docker compose logs waha
```

If **Connect** shows *"Could not reach the WhatsApp gateway"*:

- Confirm `WAHA_BASE_URL` points at the gateway (`http://waha:3000` in Compose).
- Confirm `WAHA_API_KEY` matches the container's `WHATSAPP_API_KEY`.

If the status is stuck:

- Retry **Connect** and scan a fresh QR code.
- Check the phone's internet connection.
- **Disconnect**, then **Connect** again.

## Messages Arrive on the Phone but Not in the App

Incoming messages reach the app by webhook, so the gateway must be able to call
back to it.

- `WAHA_WEBHOOK_URL` (or `APP_URL`) must be reachable **from the WAHA
  container** — inside Compose that is `http://app:3000/...`, not `localhost`.
- If `WAHA_WEBHOOK_HMAC_KEY` is set in the app, the same value must have been
  applied to the session. Click **Connect** on the number again to re-apply the
  webhook configuration.
- Check the app logs for `Invalid signature` (401) on `/api/webhooks/waha`.

## AI Not Replying

Check all four conditions:

1. Global auto reply is ON (`Settings`)
2. The conversation's **AI Auto Reply** toggle is ON (`Inbox`)
3. A bot is available — assigned to the conversation or contact, or set as the
   system default — and that bot is **enabled**
4. The bot has a working API key, either stored on the bot or in
   `OPENAI_API_KEY` / `GEMINI_API_KEY`

The message is always stored even when the AI does not reply, so it will be in
the Inbox either way. If the AI failed rather than skipped, the thread shows a
red system note with the error.

## Messages Show as Failed

The thread displays the reason on the failed bubble. Common causes:

- *"WhatsApp gateway is unreachable"* — the WAHA container is down.
- *"WhatsApp session is not running"* — reconnect the number.
- *"gateway rejected the request"* — `WAHA_API_KEY` mismatch.

## Blast Campaign Paused Itself

A campaign pauses automatically when the session is not connected, or after 5
consecutive send failures. Reconnect the number, then **Resume**.

## No Contacts Showing

- Contacts appear only after real incoming WhatsApp messages.
- They are not pre-created manually.
