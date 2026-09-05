# Tools & Sheet Capture

Tools let a bot do something other than talk. Today there is one kind —
**sheet capture**: the AI collects a set of details from the customer mid-chat
and writes them to a Google Sheet.

The two cases this was built for:

| Tool | When the AI calls it | Sheet tab |
| :--- | :--- | :--- |
| `capture_sales_lead` | Customer shows buying intent | `Leads` |
| `capture_support_issue` | Customer reports a problem | `Support` |

Both are templates on the Tools page. Neither is hardcoded — the fields, the
tab and the "when to use this" description are all editable, and you can add a
third capture type without touching code.

---

## 1. Why a sheet link is not enough

A Google Sheet link — even one set to "anyone with the link can edit" — cannot
be written to by an API. Google's Sheets API always requires OAuth or a service
account. The way around it, without asking you to set up a Google Cloud project,
is a small **Apps Script** deployed on your own sheet. It gives you a plain web
address that accepts a row and appends it.

So each tool needs two things from you:

1. the **sheet link** (for your own reference), and
2. the **Apps Script URL** that actually does the writing.

---

## 2. Setting up the sheet (once per sheet)

1. Open the Google Sheet you want rows in.
2. **Extensions → Apps Script**.
3. Delete the contents of `Code.gs` and paste in
   [`scripts/apps-script/capture.gs`](../scripts/apps-script/capture.gs).
4. Change the first line from `var SECRET = 'CHANGE_ME'` to a long random
   string. Keep it — you paste the same value into the dashboard.
5. **Save** (disk icon).
6. **Deploy → New deployment → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
7. Authorise when prompted. Google shows an "unverified app" warning because
   the script is yours and not published — click **Advanced → Go to (project)**.
8. Copy the **Web app URL**. It ends in `/exec`.

> **The `/exec` URL is a credential.** Anyone who has it can reach your script.
> The shared secret is what stops them writing rows, which is why step 4 is not
> optional. Treat the URL like a password.

The script creates the tab and its header row on the first capture, and widens
the headers automatically if you add a field later.

---

## 3. Creating a tool

**Tools → + Sales lead** (or **+ Support ticket**) gives you a filled-in
starting point. Then:

| Field | What it does |
| :--- | :--- |
| **Tool name** | What the AI calls it. Lowercase, underscores, no spaces. |
| **Sheet tab** | Which tab rows go to. Created if missing. |
| **When should the AI use this?** | **This is the routing logic.** It is how the AI decides sales vs support. |
| **Sheet link** | Reference only. |
| **Apps Script URL** | The `/exec` URL from step 8. |
| **Shared secret** | Must match `SECRET` in the script. |
| **Fields to collect** | The columns. Order here = column order in the sheet. |

Both the URL and the secret are write-only. Once saved they are never sent back
to the browser — the form shows `••••••••` and leaving it blank keeps what is
stored, exactly like a bot's API key.

### Writing a good description

The description is the whole routing mechanism, so say when *not* to call it:

> Capture a sales enquiry. Call this once you have collected the customer's
> name, contact details and which product they are interested in. **Do not call
> it for support questions.**

### Fields

Each field has a key (the machine name), a label (the sheet column header), a
type, and whether it is required.

- **Required** fields are what the AI chases. If it tries to save without one,
  it is told which is missing and asks the customer for it on the next message.
  You do not write the question — the AI phrases it in context.
- The **hint** tells the AI what belongs in the field, e.g. *"the product or
  plan they asked about"*.
- **Choice** fields restrict the value to a list, e.g. `low, medium, high`.

> Renaming a field key after rows exist shifts the columns for new rows. Change
> the **label** freely; leave the **key** alone.

---

## 4. Assigning tools to a bot

**Bots → (your bot) → Tools** — tick the ones it may use. A bot with nothing
ticked behaves exactly as it did before tools existed.

You will usually tick both capture tools on one bot and let the AI route between
them. Two separate bots also works if you want different personalities.

---

## 5. What a conversation looks like

```
Customer   I'm interested in the Pro plan
Bot        Happy to help! Could I get your name and the best email to reach you?
Customer   Kelvin Wong, kelvin@example.com
           → capture_sales_lead runs, row appended to "Leads"
Bot        Thanks Kelvin — our sales team will be in touch shortly.
```

The AI asked for the email itself because `email` was marked required. Nothing
in the bot prompt describes that exchange.

Every tool run also leaves a line in the Inbox thread and the Logs page
(`Ran tool: capture_sales_lead`) so an operator can see what happened. It is
excluded from the AI's own memory of the conversation.

### Inspecting a run

On the **Logs** page, click any row to open its details. For a tool run that
shows:

- **Submitted to sheet** — the exact columns that went over the wire, by their
  sheet header. If nothing was sent it says *"No submission — nothing was sent"*
  rather than showing you data that never left the app.
- **What the AI passed** (collapsed) — the raw field keys before they were
  mapped onto column headers. Open this when the sheet columns are not what you
  expected.
- The sink error, and a **Retry sync** button for anything not yet synced.

A clean run shows *"None — this event completed cleanly."* under Error.

> The two lists differ on purpose. The AI passes `product`; the sheet receives
> `Interested Product`. The submitted payload also carries Captured At, Contact
> Name, Phone and Conversation ID, which the AI never sees. The shared secret is
> never recorded or displayed.

Three outcomes are worth telling apart:

| Log row | What it means |
| :--- | :--- |
| `sent`, no error | Captured and written to the sheet. |
| `failed`, sink error | Captured here, sheet write failed. Retryable — nothing lost. |
| `failed`, "No Apps Script URL configured" | The tool was never finished. Nothing was transmitted; the capture is safe. Set the URL, then retry. |
| `failed`, "Missing required details…" | The AI called the tool too early. Nothing was captured; it asked the customer for the rest. Normal, not a fault. |

---

## 6. Captures and retries

**Tools → Captures** lists every capture attempt, newest first. The Logs page
shows the same failures in the context of the conversation they came from.

| Status | Meaning |
| :--- | :--- |
| `synced` | Sent and written to the sheet. |
| `failed` | Sent, but the sheet rejected it or was unreachable. |
| `not submitted` | **Nothing was sent at all** — the tool has no Apps Script URL. Finish configuring it, then retry. |
| `pending` | The app stopped mid-write. Retry. |

**A failed capture is not a lost lead.** The details are written to the database
*before* the sheet is called, so a wrong URL, an expired deployment or a Google
outage costs you the sync, not the data. Fix the tool's configuration, then hit
**Retry** — it re-sends with the original capture time and contact.

The customer is never told the write failed. They are told their details were
recorded, because they were.

### Duplicates

Rows are matched on conversation ID. A customer who repeats their details
updates their existing row rather than creating a second one.

---

## 7. Limits and behaviour

- The AI gets **3 tool rounds** per reply. On the last one, tools are withdrawn
  and it must answer in words — a model stuck on a failing tool cannot loop.
- The Apps Script call times out after **10 seconds**.
- Tools only run on conversations in **auto** mode. Switching a thread to human
  stops them, like every other AI behaviour.
- Deleting a tool keeps its past captures — they are the record of what a
  customer told you.

---

## 8. Privacy

Captured details — names, phone numbers, email addresses, whatever you have
configured — are sent to Google and stored in your sheet. Collect only what you
need, and make sure the sheet's sharing settings match how sensitive that is.
Anyone you share the sheet with can read every lead in it.

---

## 9. Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| `Apps Script did not return JSON` | The deployment is not set to *Execute as: Me* / *Who has access: Anyone*, or authorisation was never completed. Redeploy. |
| `Bad secret` | The dashboard's shared secret does not match `SECRET` in the script. |
| `SECRET not set in the script` | Step 4 was skipped. |
| `Cannot reach Apps Script` | The URL is wrong, or the server has no outbound internet access. |
| `Apps Script returned 404` | The deployment was deleted. Create a new one and paste the new URL. |
| AI never calls the tool | The description is too vague, or the tool is not ticked on the bot. Say explicitly when to use it. |
| AI calls the wrong tool | The two descriptions overlap. Add "do not call this for X" to both. |
| Row written but columns are shifted | A field key was renamed after rows existed. |

**After editing the script, you must redeploy** (*Deploy → Manage deployments →
edit → Version: New version*). Saving alone does not update the live web app.
