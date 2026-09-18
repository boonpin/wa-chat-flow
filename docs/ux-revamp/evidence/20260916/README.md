# SME enhancement implementation evidence — 16 September 2026

**Current Settings layout:** [Content navigation evidence](./settings-navigation/README.md)
shows the latest Settings overview, agent list, WhatsApp and Technical settings pages.

**Update:** [Multiple-agent correction evidence](./multiple-agents/README.md) supersedes
the original Settings and business-setup screenshots below. The older captures preserve
the first enhancement pass; current setup exposes multiple configurable AI agents.

These are application screenshots from a private local browser and an isolated,
synthetic database. Names, messages and credentials are test fixtures. No customer
database or live WhatsApp, paid AI or Google Sheets integration was used.

| Screen | Desktop | Phone |
| --- | --- | --- |
| Dashboard | [1440px](./dashboard-1440.png) | [390px](./dashboard-390.png) |
| Inbox | [1440px](./inbox-1440.png) | [390px](./inbox-390.png) |
| Activity | [1440px](./activity-1440.png) | [390px](./activity-390.png) |
| Settings | [1440px](./settings-1440.png) | [390px](./settings-390.png) |
| Business setup | [1440px](./business-1440.png) | [390px](./business-390.png) |
| Time & costs | [1440px](./report-1440.png) | [390px](./report-390.png) |

[Recorded observations](./observations.json) cover six screens at 1440, 390 and
320px, with no horizontal page overflow and no page errors. Screenshots were refreshed
after final copy/layout changes. Exact figures and attention counts reflect the fixture
state, not real business performance. Technical details are intentionally collapsed.

Browser interaction checks exercised real authentication and application APIs for
takeover, stale-version conflicts, future contact preferences, saved business details
and emergency pause; Activity drilldown and native-dialog Escape were exercised.
The preview answer alone was intercepted with a synthetic response to test its UI.
No actual preview/provider success is claimed.

Reproduce backend regression checks with `pnpm test:uiux`, which creates and removes
its own temporary database and simulates the messaging/AI boundaries. Run the app with
an explicit temporary DATA_DIR and synthetic credentials before browser verification.
The production customer database must not be used as a browser-test fixture.

These checks establish rendering and implementation behavior, not representative SME
usability. The field-study tasks in the enhancement plan remain to be tested with people.

The final Settings and Help navigation replaces the original Settings overview shown above.
See [Settings and Help navigation evidence](./settings-help-navigation/README.md) for the
current content tabs, technical side navigation and Help sections.
