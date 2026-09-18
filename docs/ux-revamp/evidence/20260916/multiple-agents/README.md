# Multiple-agent correction evidence

The corrected product retains the existing AI Bot configuration surface as **AI agents**,
visible in business Settings. Guided setup and preview now target individual agents.
These screenshots and browser checks use a private checkout and synthetic database;
the user's running development server and customer database were not used.

| Screen | Desktop | Phone |
| --- | --- | --- |
| Settings: visible AI agents entry | [1440px](./settings-1440.png) | [390px](./settings-390.png) |
| Multiple-agent list | [1440px](./agents-1440.png) | [390px](./agents-390.png) |
| Selected agent's details and preview | [1440px](./agent-details-1440.png) | [390px](./agent-details-390.png) |

[Observations](./observations.json) record seven interaction flows and nine reflow checks
at 1440, 390 and 320px, with no page errors or horizontal page overflow.

Actual browser/API actions created separate sales and support agents, edited sales while
preserving support, retained original bot IDs/instructions/tools, cancelled and confirmed
custom-prompt conversion, and selected independent future/current agents in Contacts and
Inbox. The preview response alone was intercepted; its request was checked against the
selected saved agent ID. No paid model or live customer integration was called.

`pnpm test:uiux` additionally checks legacy guided-profile migration, independent config,
disabled/tool/default preservation, stale edits, later custom-instruction preservation,
and actual reply routing through customer-selected sales and support agents with mocked
provider boundaries. Representative SME usability and live integrations remain unverified.
