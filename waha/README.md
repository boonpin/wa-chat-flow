# WAHA — WhatsApp gateway

This directory is a **standalone deployment**, independent of the WA Chat Flow
application. It can be brought up, restarted, upgraded or moved to another host
without touching the app.

```bash
cd waha
cp .env.example .env     # fill in the three secrets below
docker compose up -d
```

## Configuration

`.env` here is separate from the application's `.env` in the parent directory.
Only one value must match between them: `WAHA_API_KEY`.

| Variable | Purpose |
| --- | --- |
| `WAHA_API_KEY` | Protects the REST API. **Must be identical** to the app's `WAHA_API_KEY`. |
| `WAHA_DASHBOARD_USERNAME` | Login for the web dashboard. Used nowhere else. |
| `WAHA_DASHBOARD_PASSWORD` | Login for the web dashboard. Used nowhere else. |

Generate secrets with `openssl rand -hex 32`.

## Two separate authentication systems

This is the single most common source of confusion:

| What you are opening | How it authenticates |
| --- | --- |
| Dashboard (`/`, `/dashboard`) | Browser **basic auth** — the `WAHA_DASHBOARD_*` credentials |
| REST API (`/api/...`, `/health`) | **`X-Api-Key` header** — the `WAHA_API_KEY` value |

**Logging into the dashboard does not authorise the API.** They are unrelated.
So pasting an API URL into the address bar returns `401 Unauthorized`, because a
browser sends neither the header nor the key:

```
http://localhost:3001/api/sessions?all=true        → 401
```

For quick browser checks, WAHA also accepts the key as a query parameter:

```
http://localhost:3001/api/sessions?all=true&x-api-key=YOUR_KEY
```

From a terminal, prefer the header:

```bash
curl -H "X-Api-Key: YOUR_KEY" http://localhost:3001/api/sessions?all=true
```

Note that a key in a URL leaks into browser history, proxy logs and referrer
headers — fine for local debugging, not for anything shared.

## Dashboard shows "Unauthorized" after you log in

Expected on a first visit, and it is **not** a server problem — the dashboard is
a browser app that keeps its own list of servers in `localStorage["servers"]`.
When that entry does not exist it falls back to a built-in default whose API key
is the literal string `admin`:

```js
{ id: "waha_000000000000000001", name: "WAHA",
  connection: { url: window.location.origin, key: "admin" } }
```

So the page itself loads (basic auth succeeded) but every call it makes —
`/api/version`, `/api/sessions?all=true`, `/api/server/status` — is sent with
the wrong key and comes back `401`.

Fix it by giving the dashboard your real key, either through its server settings
UI, or directly in the browser console on the dashboard page:

```js
localStorage.setItem("servers", JSON.stringify([{
  id: "waha_000000000000000001",
  name: "WAHA",
  connection: { url: window.location.origin, key: "YOUR_WAHA_API_KEY" }
}]));
location.reload();
```

This is per-browser state, so repeat it on each browser or profile you use. It
does not affect the API, the application, or any other client.

Note you cannot avoid this by setting `WAHA_API_KEY=admin` to match the default
— WAHA treats `admin` as a weak value and replaces it with a random key at
startup.

## Networking

The container publishes to `127.0.0.1:3001` only, so it is reachable from the
host but not from the internet. **Keep it that way.** Anyone who can reach this
API can read your chats and send messages from your number.

The application reaches WAHA over the Docker network this project creates
(`waha_default`); the app's compose file joins it as an external network.

Webhooks travel the other way — WAHA calls *into* the app. Inside this
container, `localhost` is the container itself, so the app's address must be:

- **App in Docker on the same host:** `http://app:3000/api/webhooks/waha`
- **App on the host (local dev, macOS/Windows):** `http://host.docker.internal:3000/api/webhooks/waha`
- **App on another host:** its private address

That value is set on the *app* side as `WAHA_WEBHOOK_URL`; the app pushes it
into the session whenever you press **Connect**.

## Storage

`./data/sessions` holds the WhatsApp logins — a Chromium profile per session,
which grows over time. `./data/media` holds downloaded attachments. Both are
gitignored. Losing `data/sessions` means re-scanning the QR code, so include it
in your backups (the app's `pnpm backup` covers it via `WAHA_STORAGE_DIR`).

`stop_grace_period` gives Chromium time to flush its profile on shutdown;
killing it abruptly can leave a session unrestorable.

## Health

```bash
curl -H "X-Api-Key: YOUR_KEY" http://localhost:3001/health
curl -H "X-Api-Key: YOUR_KEY" http://localhost:3001/api/sessions?all=true
docker compose logs -f
```

The container healthcheck sends the API key itself — without it `/health`
answers 401 and the container never reports healthy.
