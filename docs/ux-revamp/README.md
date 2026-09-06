# WA Robot — Phase 1 UI/UX proposal

Status: **Proposed, not implemented.** Prepared 6 September 2026.

WA Robot should become a calm operational workspace where an SME owner or operator can answer three questions immediately: **Which customer needs me? Can this WhatsApp number communicate? What will the AI do next?**

The current product has useful capabilities, but users must reconstruct its behavior across screens. The revamp should change how work is organized, how status is explained, and how configuration is completed, alongside the visual system.

## Read the proposal

1. [Product UX audit](./audit.md) — complete frontend inventory, evidence, prioritized findings, workflow friction, documentation gaps.
2. [Information architecture and workflows](./information-architecture.md) — navigation, route mapping, settings ownership, page composition, AI/human state model.
3. [Shared design system](./design-system.md) — tokens, component contracts, responsive behavior, accessibility, feedback and empty states.
4. [Phased implementation plan](./implementation-plan.md) — Phases 2–10, acceptance criteria, API boundaries and measurement.
5. [Visual direction specimen](./direction.png) ([SVG source](./direction.svg)) — palette, hierarchy, navigation and reply-status examples. This is a proposal artifact, not an application screen.
6. [Browser evidence](./evidence/README.md) — current UI rendered with synthetic data, desktop and phone captures, and recorded observations.

## Decisions proposed

- Put **Inbox** immediately after **Overview**. Keep **Contacts** alongside daily work.
- Group **AI bots**, **Tools**, **Reply settings**, and the existing **Campaigns** under **Automation**, with children expanded and directly accessible on desktop.
- Keep **WhatsApp channels** directly accessible as infrastructure users regularly need to repair. Define “channel” as a connected WhatsApp number; it does not mean WhatsApp's broadcast-channel feature.
- Rename **Blast → Campaigns** and **Logs → Activity**. Preserve both existing capabilities.
- Make Inbox the only conversation composer. Contacts opens a customer profile and links to the relevant conversation/history.
- Give every configuration one owner. Put global reply policy in Automation; bot credentials in the bot editor; sheet credentials in the tool editor; channel lifecycle in WhatsApp channels. Settings provides orientation and setup/access help without duplicating editors.
- Use a light, paper-like neutral canvas, restrained deep green actions, readable body type, compact rows, and blue AI / neutral human labels. Green communicates successful connectivity or completion; human mode is not a warning.
- Use a shared **reply status line**: channel identity and reported connection, reply mode, selected bot or fallback, and any known blocker. Never turn one green toggle into a claim that the whole system works.

## Scope and evidence

Every application frontend source file, every page route, shared components, all user-guide documents, architecture documentation, and all six existing screenshots were inspected. Browser checks use an isolated copy and intercepted API fixtures; no customer data, gateway connection, AI call, or message send is part of the audit. Findings distinguish source evidence, browser observations and recommendations. This is an expert audit, not a user research study or accessibility certification.

Only proposal documents and audit evidence belong to Phase 1. Application code, API routes, business logic, database schema, dependencies and the existing guide/screenshots remain untouched. The user's existing untracked skill files are outside this change.

The proposal is intentionally bounded by today's capabilities. It does not introduce a workflow canvas, team assignment, unread counters, OAuth integrations, AI testing endpoints, billing, or invented analytics. Small read-API gaps that prevent accurate health or complete history are identified explicitly in the implementation plan.
