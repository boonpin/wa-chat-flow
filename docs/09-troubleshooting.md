# Troubleshooting

## Cannot Login

- There are no default credentials. Confirm `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  were set before first start, or create an account with
  `ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm seed`.
- Make sure the app is running on `http://localhost:3000` (or your `APP_URL`).
- In production, `JWT_SECRET` must be set. If it changed, everyone is signed out.

## WhatsApp Not Connecting

First check the gateway — most connection problems are WAHA, not the app. It is
a separate Compose project:

```bash
cd waha
docker compose ps        # up and healthy?
docker compose logs -f
```

If **Connect** shows *"Could not reach the WhatsApp gateway"*:

- Confirm `WAHA_BASE_URL` points at the gateway (`http://waha:3000` in Compose,
  `http://127.0.0.1:3001` in local development).
- Confirm `WAHA_API_KEY` in the app's `.env` **matches** `WAHA_API_KEY` in
  `waha/.env`. These are two separate files and drift easily.

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

## WAHA API Returns 401 in the Browser

Not a fault. WAHA has two independent auth systems: browser basic auth for the
dashboard, and the `X-Api-Key` header for the REST API. **Logging into the
dashboard does not authorise the API**, and an address bar sends no headers.

For a quick browser check, pass the key as a query parameter:

```
http://localhost:3001/api/sessions?all=true&x-api-key=YOUR_KEY
```

From a terminal use the header instead:

```bash
curl -H "X-Api-Key: YOUR_KEY" http://localhost:3001/api/sessions?all=true
```

## WAHA Dashboard Says "Unauthorized" After Logging In

The dashboard stores its own copy of the API key in the browser
(`localStorage["servers"]`) and defaults to the literal string `admin`. Logging
in with the dashboard password does not supply it. Set your real key in the
dashboard's server settings, or run this in the browser console on the dashboard
page:

```js
localStorage.setItem("servers", JSON.stringify([{
  id: "waha_000000000000000001", name: "WAHA",
  connection: { url: window.location.origin, key: "YOUR_WAHA_API_KEY" }
}])); location.reload();
```

See [waha/README.md](../waha/README.md).

## Log Says "Could not resolve …@lid to a phone number"

WhatsApp addresses some one-to-one chats by a *linked identity* (`@lid`) instead
of a phone number. These are real customers, and the app resolves them through
the gateway's LID mapping before storing a contact.

The warning means the gateway has no mapping for that sender yet, so the message
was dropped rather than filed under a fake number. This usually resolves itself
once the session has synced contacts. To check what the gateway knows:

```bash
curl -H "X-Api-Key: YOUR_KEY" \
  "http://localhost:3001/api/YOUR_SESSION_ID/lids/count"
curl -H "X-Api-Key: YOUR_KEY" \
  "http://localhost:3001/api/YOUR_SESSION_ID/lids/THE_LID@lid"
```

If mappings are consistently missing, reconnect the session so it re-syncs.

## AI Not Replying

Check all four conditions:

1. Global auto reply is ON (`Settings`)
2. The conversation's **AI Auto Reply** toggle is ON (`Inbox`)
3. A bot is available — assigned to the conversation or contact, or set as the
   system default — and that bot is **enabled**
4. The bot has an AI provider, that provider is **enabled**, and it has a
   working API key — either stored on the provider or in `OPENAI_API_KEY` /
   `GEMINI_API_KEY`

A bot whose provider was deleted or turned off shows a warning on the `AI bots`
list and in the Inbox thread header, and every reply it attempts fails with the
reason in the thread.

The message is always stored even when the AI does not reply, so it will be in
the Inbox either way. If the AI failed rather than skipped, the thread shows a
red system note with the error.

## Messages Show as Failed

The thread displays the reason on the failed bubble. Common causes:

- *"WhatsApp gateway is unreachable"* — the WAHA container is down.
- *"WhatsApp session is not running"* — reconnect the number.
- *"gateway rejected the request"* — `WAHA_API_KEY` mismatch.

## A Campaign Paused Itself

A campaign pauses automatically when the number is not connected, or after 5
consecutive send failures. Open **Campaigns**, reconnect the number from
**WhatsApp channels**, then choose **Resume**.

Pausing AI replies does not pause a campaign, and a campaign does not need a
bot — the two are independent.

## No Contacts Showing

- Contacts appear only after real incoming WhatsApp messages.
- They are not pre-created manually.
