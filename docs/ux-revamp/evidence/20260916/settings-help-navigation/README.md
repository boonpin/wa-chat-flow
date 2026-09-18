# Settings and Help navigation evidence

Settings opens AI agents without an Overview tab. Technical settings opens AI connections,
with a side navigation inside the content container. Help separates Using the app from
Setup & troubleshooting; Access and setup is now a Help article.

| Screen | Desktop | Phone |
| --- | --- | --- |
| AI agents | [1440px](./agents-1440.png) | [390px](./agents-390.png) |
| Technical settings | [1440px](./technical-1440.png) | [390px](./technical-390.png) |
| Google Sheets | [1440px](./sheets-1440.png) | [390px](./sheets-390.png) |
| Activity | [1440px](./activity-1440.png) | [390px](./activity-390.png) |
| Workspace preferences | [1440px](./workspace-1440.png) | [390px](./workspace-390.png) |
| Using the app | [1440px](./using-help-1440.png) | [390px](./using-help-390.png) |
| Setup & troubleshooting | [1440px](./setup-help-1440.png) | [390px](./setup-help-390.png) |
| Access and setup article | [1440px](./access-help-1440.png) | [390px](./access-help-390.png) |

[Recorded observations](./observations.json) contain 19 navigation/interaction checks and
24 reflow checks across 1440, 390 and 320px, with no page errors or horizontal page overflow.
Checks exercised real authentication, Settings default/section selection, technical sidebar
placement, Google Sheets editor selection, cancel and save return paths, start-page persistence,
Activity selection, Help task separation and the legacy access and auto-reply shortcuts.
Desktop and phone screenshots were visually reviewed.

Verification used a private app copy, synthetic credentials, agents and tools, and a temporary
SQLite database. No live AI, WhatsApp or Sheets call was made. TypeScript, ESLint and the production Webpack build passed. The final build used a
private dependency copy so standalone tracing could complete without workspace symlinks.
This evidence supersedes the earlier Settings overview/hub screenshots for navigation and
establishes implementation behavior rather than representative SME usability results.
