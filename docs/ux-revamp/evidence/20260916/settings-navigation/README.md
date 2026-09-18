# Settings content navigation evidence

Historical capture: Overview and the technical hub were subsequently replaced.
See [current Settings and Help evidence](../settings-help-navigation/README.md).

Settings sections now share navigation above the page content, inside main rather than
inside the global header. Technical settings is a dedicated hub.

| Screen | Desktop | Phone |
| --- | --- | --- |
| Settings overview | [1440px](./overview-1440.png) | [390px](./overview-390.png) |
| AI agents | [1440px](./agents-1440.png) | [390px](./agents-390.png) |
| Technical settings | [1440px](./technical-1440.png) | [390px](./technical-390.png) |
| WhatsApp numbers | [1440px](./whatsapp-1440.png) | [390px](./whatsapp-390.png) |

[Observations](./observations.json) record 20 browser checks and 12 reflow checks at
1440, 390 and 320px. Every Settings section navigated and selected correctly; agent
child pages and technical destinations retained the expected section. The technical
hub’s AI connection link and keyboard link activation worked. Daily pages omitted the
Settings navigation. The navigation was confirmed to be inside main, outside header.
No page errors or horizontal page overflow were observed.

Screenshots use a private checkout, synthetic agent and temporary database. No live
AI/WhatsApp/Sheets integration or customer database was used. TypeScript and ESLint
also passed. These rendering checks do not claim representative SME usability results.
