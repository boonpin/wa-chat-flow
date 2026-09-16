# Impact report implementation brief

Status: approved for implementation on 16 September 2026.

## Outcome

Add a workspace-level `/reports/impact` page that shows what AI handled, how
quickly it replied, the tokens it used, and the time and cost it may have saved.
Keep `/dashboard` operational: known issues and open conversations continue to
lead there.

## Evidence model

Recorded facts:

- successful AI and human service replies;
- distinct conversations and contacts assisted by AI;
- median response time from the last customer message in a burst;
- AI calls, failures, input tokens and output tokens;
- activity grouped by day, bot and model.

Estimates:

- time saved = successful AI reply turns × configured manual minutes per reply;
- labor value = estimated hours × configured hourly labor cost;
- AI cost = tokens × the model rate effective when the call occurred;
- net savings = labor value − AI cost.

System notices, campaign sends and failed outgoing messages are not service
replies. Failed AI calls do count toward token cost when token usage is present.
No estimate is shown as a recorded fact.

## Page structure

1. Header with 7, 30 and 90-day periods and an Edit assumptions action.
2. Evidence chain: AI reply turns → time saved → labor value − AI cost → net
   savings.
3. Automation and response summary.
4. Token usage and cost summary.
5. Daily activity trend with a readable data table.
6. Bot/model breakdown.
7. Assumption editor and calculation disclosure.

## Data and failure contract

- Missing operating assumptions leave activity visible and replace estimates
  with a direct setup action.
- Missing model prices produce an incomplete-cost notice, never a zero-cost
  claim.
- The first saved rate can cover earlier usage; later rate changes take effect
  from the time they are saved.
- Deleted bots stay in historical breakdowns as `Deleted bot`.
- A failed refresh retains the last good report and identifies it as stale.
- Empty workspaces explain that results appear after the first AI reply.

## Acceptance criteria

- Range changes update every figure and compare against the preceding period.
- All formulas are covered by deterministic tests or fixtures.
- Costs use one configured reporting currency and versioned model rates.
- The page works at 320, 390, 768, 1024 and 1440px without document overflow.
- Keyboard focus, headings, current range and chart equivalents are accessible.
- Build and lint complete without new errors.

