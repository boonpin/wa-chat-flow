# WhatsApp Connection

Use the `WhatsApp` page to connect one or more WhatsApp numbers.

Connections are handled by **WAHA**, a gateway service that runs alongside the
app. Your sessions live there, which is why they survive app restarts and
redeploys.

## Steps

1. Click **+ Add Number** and give it a name (e.g. Sales, Support).
2. Click **Connect** and wait for the QR code.
3. On your phone: WhatsApp -> Linked Devices -> Link a Device.
4. Scan the QR code.

## Status Flow

- `Offline`: session is not running
- `Starting`: the gateway is bringing the session up
- `Waiting for scan`: QR is ready
- `Connected`: session active, messages flow
- `Failed`: the gateway could not start the session — click **Reconnect**

## Disconnect

- Click **Disconnect** if needed.
- Confirm the prompt.
- Auto replies stop for that number until you reconnect.

## Remove

**Remove** logs the number out and deletes its stored session from the gateway.
You will need to scan a new QR code to use it again.

## Notes

- Each number needs its own QR scan; several can be connected at once.
- The QR refreshes automatically while the status is `Waiting for scan`.
- If every number shows `Offline` and **Connect** reports a gateway error, the
  WAHA container is probably not running. See
  [Troubleshooting](./09-troubleshooting.md).

## Screenshot

![WhatsApp](./screenshots/03-whatsapp.png)
