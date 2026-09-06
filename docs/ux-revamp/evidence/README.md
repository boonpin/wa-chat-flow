# Browser audit evidence

Captured 6 September 2026 from the current, unmodified application UI in an isolated temporary copy. All business data is synthetic. API requests were intercepted, including mutations; no actual message, AI request, Google write or WhatsApp connection was made. Authentication used a short-lived test token signed only for that isolated copy.

The installed default shell runtime was too old for this Next application, so the audit used the existing Node 22 installation. The shared browser tool's profile was busy; an isolated local Playwright/Chrome process was used instead. Neither workaround changed application files or dependencies.

## Coverage

Twelve visible routes at **1440×900** and **390×900**, including populated Inbox, bot editor and tool editor. Root `/` redirect was inspected in source. Nine modules additionally exercised empty and synthetic HTTP 500 responses. A rejected login request tested network recovery. Five focused checks covered successful tool rendering, Resolve/draft behavior and the Contacts drawer.

These snapshots are viewport captures, not full-page guarantees. Browser focus/scrolling during interaction may move a narrow overflowing page horizontally. The `scrollWidth` readings below measure the full document independently.

| Current page | Desktop | Phone | Document width at 390px |
| --- | --- | --- | ---: |
| Login | [Image](./login-1440.png) | [Image](./login-390.png) | 390 |
| Overview | [Image](./dashboard-1440.png) | [Image](./dashboard-390.png) | 514 |
| Inbox + selected conversation | [Image](./inbox-1440.png) | [Image](./inbox-390.png) | 930 |
| Bot editor | [Image](./bots-1440.png) | [Image](./bots-390.png) | 434 |
| Tool editor | [Image](./tools-1440.png) | [Image](./tools-390.png) | 593 |
| Contacts | [Image](./contacts-1440.png) | [Image](./contacts-390.png) | 1004 |
| Campaign list | [Image](./blast-1440.png) | [Image](./blast-390.png) | 1127 |
| Campaign creation | [Image](./blast-create-1440.png) | [Image](./blast-create-390.png) | 635 |
| Campaign detail | [Image](./blast-campaign-a-1440.png) | [Image](./blast-campaign-a-390.png) | 902 |
| WhatsApp connections | [Image](./wa-1440.png) | [Image](./wa-390.png) | 506 |
| Settings | [Image](./settings-1440.png) | [Image](./settings-390.png) | 504 |
| Logs | [Image](./logs-1440.png) | [Image](./logs-390.png) | 837 |

All twelve pages fit the document width at 1440px. That does not establish form accessibility or optimal layout; Bots, for example, compresses fields severely on a phone even though its numerical overflow is smaller than Inbox's.

## Reproduced findings

| Check | Observed result |
| --- | --- |
| Render a `system` / `tool` message with `status: sent`, content and no error | Inbox displays **Something went wrong** in red |
| Type an unsent draft, Resolve the selected thread in Open, return updated list without it | Thread/composer unmount; **No conversation selected** appears |
| Contacts drawer receives current API text-type rows | Content displays `[text]` instead of the body; see [drawer capture](./contacts-legacy-chat.png) |
| Contacts drawer semantics and Escape | No dialog role found; Escape leaves drawer open |
| HTTP 500 `{ error: ... }` to module requests | Bots: `bots.map is not a function`; Contacts: `contacts is not iterable`; Settings: `bots.find is not a function` |
| Same HTTP failures for Overview, Inbox, Tools, WhatsApp, Logs and Campaigns | UI presents zero/no-record states rather than a load-error recovery view |
| Reject login fetch | Unhandled **Failed to fetch**; Sign In remains disabled and “Signing in...” |

[Raw recorded observations](./observations.json) include route dimensions, rendered empty/failure text and page errors. The `unlabelledControls` count is a DOM heuristic for missing associated labels/ARIA labels, not a complete accessible-name computation or automated WCAG conformance report. The source audit separately verifies the shared-field/switch issues.

## Reproduction method

Copy only app/component/library/build sources to a temporary directory, excluding `.env`, database/runtime directories and real credentials. Reuse installed dependencies. Serve on localhost with an audit-only JWT secret and an unreachable gateway address; intercept all `/api/**` browser requests before loading pages.

Use fixtures for named connected/failed channels, an enabled default bot, two contacts, an AI-mode open thread and a successful system/tool event. Render each page at both widths; select the bot, tool and conversation. Then return empty arrays with valid settings objects for first use, and HTTP 500 JSON errors for failures. Intercept a synthetic Resolve update and remove its row from the Open list. Abort the login fetch for the network-failure case. Save only synthetic text/screenshots.

This reproduces frontend rendering and interaction behavior only. No real backend writes, provider availability, QR scanning, sending, sheet sync, screen-reader walkthrough or usability sessions were validated in Phase 1.
