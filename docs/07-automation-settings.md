# Automatic replies

Open **Settings → Automatic replies** to set workspace-wide reply rules and the default
AI agent. The content navigation keeps Automatic replies selected and links to the other Settings sections. Changes apply when you save; incoming messages remain stored under every policy.

## Reply policy

| Setting | Behavior |
| --- | --- |
| Allow AI replies | Eligible new and existing conversations may use AI. Team-owned threads remain with the team. |
| Continue current AI conversations | Current AI threads continue; new conversations start with your team. Explicit handback can enable a waiting thread. |
| Pause all AI replies | Your team receives and replies manually. No new automatic send starts; an already-started send can still finish. |

Dashboard also offers an emergency global pause. Pausing AI does not pause broadcasts.
New customer AI preferences follow whether new AI conversations are allowed; changing the
workspace policy does not silently change each existing customer’s saved preference.

## Default agent

Maintain multiple agents in **Settings → AI agents**, then choose the workspace default here.
When a conversation opens, its customer’s assigned agent is copied to that thread. During
reply execution selection uses:

```text
conversation agent → workspace default → legacy default flag
```

Disabled agents are skipped. Customer default changes affect future threads; Inbox can
change the active agent independently. The page identifies the effective fallback and any
legacy-default conflict. Customer classification is not automatic.

## Reply grouping

Timing settings combine a burst of customer messages into one response. The quiet window
restarts with each eligible message, subject to the maximum wait. Save to apply changes.

Per-conversation takeover is in [Inbox](./10-inbox.md). Customer preferences and group
selection are in [Contacts](./06-contacts-management.md).

Technical connections and sheet configuration are under Settings → Technical settings.
Its inner side navigation also opens Activity and Workspace preferences. For access,
initial setup or connection repair guidance, open Help → Setup & troubleshooting.
