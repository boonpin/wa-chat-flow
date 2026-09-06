# Phased implementation plan

Phase 1 is the audit and proposal only. Work below is a future implementation sequence, not a list of completed changes.

## Delivery boundaries

Use one shared token/component system, keep existing APIs and routing behavior, and migrate one work area at a time. Shared foundations can land early, but do not redesign every page through a global CSS override. Capture visual and functional baselines before each module changes. Keep each phase reviewable as a coherent outcome.

| Phase | Scope and concrete outcome | Acceptance evidence |
| --- | --- | --- |
| **1 — Audit and proposal** | Frontend/routes/components/forms/tables/overlays/states/responsiveness, all guide documents and screenshots; IA, design contract, browser evidence and this plan | Complete inventory, source-backed findings, synthetic desktop/phone evidence, clear distinction between available data and proposed additions |
| **2 — Shell, navigation and login** | Adopt tokens and shared field/button/status/overlay/notification contracts; grouped navigation; route-aware headers and skip link; mobile nav; connection summary; sign-in/pending/recovery; Help entry | Every existing route remains reachable; active group and route correct; no shell overflow at 320/390/768/1024/1440px; keyboard/Escape/focus return; login network failure recovers. Existing modules receive necessary shell fit, not premature redesign. |
| **3 — Dashboard** | Setup checklist, known issues and operational conversation entry points; compact readiness summary with named bot and channel coverage; partial request errors | Disconnected channel cannot be hidden by another connected number; no false “all healthy”; distinguish pause from failure, zero from unavailable, live verification from reported data; no invented analytics |
| **4 — Inbox** | Stable conversation URLs; selection independent of filters; per-conversation draft retention while mounted; AI/human controls with scope; shared transcript and system-event rendering; responsive list/thread transition; contact-history foundation | Successful tool event is not an error; failed capture says details retained; sender attribution correct; Resolve/filter/back preserves drafts/context; IME Enter safe; send failures do not disappear; 401/404/500 and stale refresh have recovery. Known history limits clearly addressed. |
| **5 — AI bots** | List and full-page Instructions/Tools/AI connection editor; purposeful templates; safe defaults/credential states; real validation and dirty guard | No lost edits switching records/templates; disabled/eligible/default distinctions accurate; custom/stored model IDs preserved; blank key remains keep-existing; confirmed failures never toast success; no unsupported “test bot” capability |
| **6 — Tools** | Single create action and templates, fields-first editor, guided Apps Script setup, attachment shortcut, shared capture detail/retry states | Blank credentials preserve existing values; existing field keys/mappings retained; capture vs sync outcome explicit; in-flight retry blocked; partial tool/attachment save explained; guide links usable; no claim credentials were tested simply because saved |
| **7 — Contacts** | Search/filter/list + contact profile; reliable selection/bulk actions; conversation/history links replace duplicate composer | Default bulk assignment works; scope and partial failures reported; keyboard/touch row entry; mode effect on current/future conversation explicit; existing bot override shown; historical messages remain reachable |
| **8 — Automation and Campaigns** | `/automation/replies` owns global permission and fallback; reconcile UI terminology without changing backend precedence; Campaigns list/draft/review/progress/recipient outcomes; old `/blast` links retained | Draft settings never shown as live; global pause does not imply manual/campaign pause; known default conflict surfaced; campaign send and cancellation clearly confirmed; actual status transitions only; processed ≠ delivered; skipped ≠ pending |
| **9 — WhatsApp channels** | Canonical channel route, compact named connections, add/connect continuation, QR drawer, actionable per-number failures, accurate freshness display | All five transport states + unknown/stale; scan polling and cancellation cleanup; update failures remain visible; no “Auto replies active” from connection alone; phone setup explains second-screen requirement; existing QR/connect APIs preserved |
| **10 — Settings and consistency** | Settings hub/access help; Activity table/drawer; consolidate guide; final navigation/token/copy/state/mobile/accessibility pass across all routes, including login/campaigns | No duplicate setting owners; no dead routes; no default-credential screenshots; all required component states documented; keyboard and VoiceOver task walkthroughs; responsive screenshots; meaningful build/lint/type checks; fixes to uncovered cross-module regressions |

Login is explicitly included in Phase 2 because the phase list otherwise has no login implementation stage. Existing Campaigns and Activity are explicitly included in Phases 8 and 10.

## API and business-logic boundary

The majority of the revamp is frontend composition, state presentation, forms, request handling, routes and help. Keep the database/transport/tool/AI seams intact. In particular:

- No change to global/conversation AI gates, bot selection order, contact inheritance, message sending, tools, field semantics, campaign engine or WAHA behavior just to simplify a label.
- No new billing, tenancy, agent assignment, unread or SLA model.
- No live preview that secretly sends a WhatsApp message, invokes AI or appends a sheet row.
- No API-key, sink URL or secret read-back. Preserve existing write-only semantics.
- No invented certainty: a frontend poll result is not necessarily a verified gateway health result, `hasApiKey` does not imply a valid key, and `sent` is not delivered/read.

### Explicit dependencies, not hidden feature expansion

| Gap found in current contracts | Frontend-compatible baseline | Smallest further change if required | Phase |
| --- | --- | --- | --- |
| Channel API falls back to cached status without marking it | Display **Reported status** and frontend fetch time, with an explanation that verification can be unavailable | Add read metadata such as `statusSource: live/cached`, `lastVerifiedAt`, and a safe status-check error. Preserve existing fields/status values and behavior. This is needed before claiming live system health. | Define in 2; implement only if included, before accurate live claims in 3/9 |
| Conversation list defaults to 100; detail only returns latest 200 messages | Use honest recent-result labels; no global count or “beginning of conversation” assertion | Stable cursor pagination/hasMore for conversations/messages; contact/channel/mode filters applied before pagination; exact count only if efficient and explicitly needed. This is needed for a complete scalable Inbox. | 4 |
| Contact history cannot be filtered by ID in conversations API | Use current messages/history endpoint with the shared renderer and a bounded scope; retain archive access during migration | Add contact filter and pagination to shared Inbox read endpoints; contact detail lookup if needed rather than downloading all contacts | 4/7 |
| Capture list has status/limit only, max 500, no total/cursor | State **Recent captures** and loaded count; use supported status filtering; avoid “all captures” claims | Stable pagination and optional tool/contact/conversation filters; explicit counts rather than treating latest 100 as lifetime total | 6 |
| Global default ID and legacy default flag can disagree | Show effective fallback and discrepancy; primary setter uses existing endpoint; no inaccurate “None” explanation | If eliminating legacy fallback is desired, a separately specified transactional normalization/migration with routing regression tests. This is a business change and is not part of a cosmetic revamp. | 8 decision |
| Contact bot and conversation bot updates have different scopes | Label scope correctly; separate defaults from current override | No backend change required for accurate UX. Synchronizing them automatically would change behavior. | 4/7 |
| List previews lack sender type; skipped reasons/AI-generation activity are not persisted/exposed | Remove “You:” from all outgoing previews; do not show typing or exact skipped-reply reasons | Optional additive read sender metadata; richer activity events are a separate capability, not required for core layout | 4/10 |
| No unread/assignment/SLA/time-saved analytics | Use status/mode and clearly scoped recent data | Defer analytics/team features; do not synthesize them from last-message direction | All |
| No isolated bot test or Google connection-test endpoint | Guide real operator verification and show only configuration status | Separate backend proposal for safe explicit tests with disclosed side effects; do not add in this revamp by default | 5/6 |
| Failed sends may have ambiguous external delivery; no resend idempotency contract | Retain failed text, explain channel issue and let operator inspect status before manually resending | Retry/idempotency is a deliberate messaging change; do not hide it under a Retry button | 4 |
| No pause-cause field or complete skipped aggregate on campaigns | Generic “Campaign paused,” actual returned recipient errors; “Not sent” where pending/skipped cannot be separated accurately | Optional read metadata for pause reason and recipient status counts. Never infer auto-pause solely from failedCount > 0. | 8 |
| No account preferences/password/team API | Settings orientation and access help; current login/logout | New account APIs only as separate product work | 2/10 |

Read-API additions above are proposed dependencies, not authorization to rewrite backend semantics. When a phase reaches one, make the intended UI and minimal additive contract reviewable first. No such change was made in Phase 1.

## Component and data-state implementation order

1. Repair shared tokens, Button/LinkButton, FormField and Switch naming/disabled semantics; introduce a shared status vocabulary.
2. Add one accessible overlay foundation, Toast/Banner/InlineError, Skeleton and EmptyState; ensure consistent keyboard/focus behavior.
3. Build AppShell, PageHeader, route tabs and filter controls. Keep page layouts in control of content width/density.
4. Build shared TableToolbar/Pagination/BulkActionBar as real list use cases migrate. Never implement unsupported filter/sort controls.
5. Build shared Transcript/Message/EventRow/Composer for Inbox, then reuse for contact history.
6. Use a common async-state convention (loading, loaded, refreshing, error, unauthorized), HTTP result checking, cancellation/stale-response guards and per-action pending state. Do not change backend business decisions.

Avoid pulling server-only bot selection/database modules into client bundles. A UI explanation of routing must preserve existing semantics and say when data is incomplete. An authoritative server-provided explanation can replace the presentation derivation later without changing the visual contract.

## Validation that matters

For each phase run appropriate existing lint/type/build checks after implementation. Fix or distinguish pre-existing failures; a passing build does not verify UX. Add targeted regression tests only for meaningful behavior changes such as draft preservation, state interpretation, response failures and selection scope.

Use a synthetic fixture matrix:

- New installation; populated workspace; one/many channels; partially disconnected and status unavailable.
- Global paused, human mode, AI mode, disabled assigned bot, default/fallback mismatch and missing configuration.
- Empty list, no search results, slow load, network rejection, HTTP 401/404/500, failed refresh, double submission and partially successful batch.
- Successful capture/system event, failed sync, not submitted, pending, deleted tool with retained capture.
- Long conversation, older history, unsupported media, long names/messages/URLs, non-Latin text and IME composition.
- Campaign draft, sending, paused, failed, completed, cancelled, skipped recipient and mixed outcomes.
- Keyboard-only operation; modal focus; 200% text/400% zoom; reduced motion; phone portrait/landscape and open software keyboard.

After each phase update the corresponding guide and capture current successful/empty/error/mobile screenshots with synthetic content. Final consistency must include Activity, Campaigns and access help rather than only the originally named core pages.

## Success measures

These are acceptance targets, not claims from analytics or user testing:

| Outcome | Target / measurement |
| --- | --- |
| Find core work | Inbox and Contacts are one direct navigation action from any authenticated desktop page |
| Understand automation | In a task walkthrough, operator can identify reply mode, bot/fallback and channel/blocker without leaving a conversation |
| Avoid lost work | Draft survives conversation switching/filtering/resolving during the session; dirty configuration cannot be silently discarded |
| Recover safely | Known API failure never displays success; recoverable error leaves data and an action visible |
| Mobile operation | No page-level horizontal overflow on core tasks at 320/390px; list, reply, save and repair remain reachable |
| Accessible operation | Every control named and keyboard-operable; tested focus/contrast/reflow; no critical automated violations plus manual checks |
| Simplify setup | Bot creation/default selection do not require a separate settings detour; tool attachment keeps return context; checklist resumes from saved state |

Before broad rollout, validate the vocabulary and first-time checklist with a small set of SME owners/operators using tasks, not taste questions. Compare first successful reply, finding a human-mode conversation and recovering a sheet sync against the current UI. Do not manufacture task-time improvements without a baseline.

## Open product decisions

The proposal makes working recommendations so Phase 1 does not block on questions. Review these when adopting the direction:

1. Retain the proposed Automation grouping and explicit **WhatsApp channels** terminology, or prefer **WhatsApp numbers** if customer testing shows “channel” is confusing.
2. Include minimal read-API provenance/pagination to meet accurate health and full-history expectations, or explicitly ship bounded recent views first.
3. Adopt Source Sans 3 or retain Geist if a real-data typography comparison shows no usability benefit from changing it.
4. Preserve the legacy default fallback semantics now; decide normalization as a distinct behavior change only if wanted.

No implementation phase begins automatically as part of this Phase 1 deliverable.
