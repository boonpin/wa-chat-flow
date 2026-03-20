
# SKILL.md

## Feature Name

WhatsApp Blasting Module (Provider-Agnostic)

## Build Target

Next.js (App Router) + Server-side processing

---

## Objective

Build a **scalable, safe, campaign-based blasting module** that sits **on top of your existing WhatsApp provider**.

This module is responsible for:

* campaign creation
* recipient expansion
* queue processing
* rate limiting
* delivery tracking
* reply continuity

It does NOT handle:

* WhatsApp API integration
* message transport layer

---

## System Positioning

```txt
[ Next.js UI ]
        ↓
[ Blast Module API / Services ]
        ↓
[ Queue + Rate Limit Layer ]
        ↓
[ Existing WA Provider (already built) ]
```

---

## Core Modules

### 1. Campaign Manager

Controls full lifecycle of blast campaigns.

Responsibilities:

* create / edit campaign
* start / pause / resume / cancel
* scheduling
* status tracking

States:

```txt
draft → scheduled → sending → paused → completed → cancelled → failed
```

---

### 2. Audience Expansion Engine

Convert audience into **final recipient list**

Responsibilities:

* fetch users from CRM / upload / segment
* deduplicate phone numbers
* normalize phone format
* attach variables per recipient
* filter unsubscribed users

Output:

```ts
BlastRecipient[]
```

---

### 3. Template Renderer

Convert template + variables → final message

```ts
render(template, variables) => finalMessage
```

Rules:

* safe fallback for missing variables
* preview before send
* support per-recipient personalization

---

### 4. Queue Dispatcher (CRITICAL)

This is the **core engine**

Responsibilities:

* split campaign into jobs
* push jobs into queue
* control concurrency
* support pause/resume
* track job progress

---

### 5. Worker Processor

Consumes queue and sends messages via your provider

Flow:

```txt
1. get job
2. check campaign status
3. check recipient status
4. render message
5. call waProvider.send()
6. update result
7. log message
```

---

### 6. Rate Limiter

Protect your number from ban.

Responsibilities:

* throttle sending speed
* dynamic rate adjustment
* detect abnormal failures
* auto pause campaign if risky

Example:

```txt
new number → 20 msg/min
stable number → scale gradually
```

---

### 7. Delivery Tracker

Track lifecycle per recipient

States:

```txt
pending → queued → sending → sent → delivered → read → failed → skipped
```

Updated by:

* worker (send result)
* webhook (delivery/read)

---

### 8. Reply Router

When user replies:

* link to campaign
* route to CRM inbox
* assign to team

---

## Data Structures

### Campaign

```ts
interface BlastCampaign {
  id: string;
  tenantId: string;
  name: string;
  messageTemplate: string;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed';
  scheduleAt?: string;

  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;

  createdAt: string;
}
```

---

### Recipient

```ts
interface BlastRecipient {
  id: string;
  campaignId: string;
  phone: string;
  name?: string;
  variables?: Record<string, string>;

  status: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';

  providerMessageId?: string;
  error?: string;

  sentAt?: string;
}
```

---

### Message Log

```ts
interface MessageLog {
  id: string;
  campaignId: string;
  phone: string;
  content: string;
  status: string;
  providerMessageId?: string;
}
```

---

## Sending Flow (Final)

```txt
[Create Campaign]
        ↓
[Expand Audience]
        ↓
[Create Recipients]
        ↓
[Queue Jobs]
        ↓
[Worker Sends Message]
        ↓
[Update Status]
        ↓
[Webhook Update Delivery]
```

---

## Queue Design

Each recipient = 1 job

```ts
{
  campaignId,
  recipientId
}
```

---

### Worker Pseudo Code

```ts
async function processJob(job) {
  const recipient = await getRecipient(job.recipientId);
  const campaign = await getCampaign(job.campaignId);

  if (campaign.status !== 'sending') return;

  const message = render(campaign.template, recipient.variables);

  const result = await waProvider.send({
    phone: recipient.phone,
    message
  });

  if (result.success) {
    markSent(recipient, result.id);
  } else {
    markFailed(recipient, result.error);
  }
}
```

---

## Rate Limiting Strategy

Basic:

```ts
concurrency = 5
delay = 2–3 seconds per message
```

Advanced:

```txt
- dynamic rate based on success rate
- slow down if fail > threshold
- random jitter delay
```

---

## Campaign Control Logic

### Start Campaign

```txt
status → sending
generate queue jobs
start worker
```

---

### Pause Campaign

```txt
status → paused
worker skips remaining jobs
```

---

### Resume Campaign

```txt
status → sending
continue remaining jobs
```

---

### Cancel Campaign

```txt
status → cancelled
stop all processing
```

---

## Next.js Integration

### Pages

```txt
/app/wa/blast/page.tsx                → campaign list
/app/wa/blast/create/page.tsx        → create campaign
/app/wa/blast/[id]/page.tsx          → campaign detail
```

---

### Components

```txt
campaign-form.tsx
audience-selector.tsx
template-preview.tsx
progress-dashboard.tsx
recipient-table.tsx
```

---

### API Routes

```ts
POST   /api/blast/campaign
GET    /api/blast/campaign
POST   /api/blast/campaign/:id/start
POST   /api/blast/campaign/:id/pause
POST   /api/blast/campaign/:id/resume
POST   /api/blast/campaign/:id/cancel
```

---

## Critical Safeguards

Must implement:

* deduplicate numbers
* skip unsubscribed users
* retry only limited times
* auto pause if failure spike
* prevent duplicate sends
* validate before campaign start

---

## Performance Strategy

* do NOT send directly in API request
* always use queue
* paginate recipient list in UI
* store aggregated stats in campaign
* avoid recalculating on frontend

---

## Future Extension (Important for you)

Since your system is ERP + CRM:

### Auto-trigger blast

* invoice due
* order ready
* delivery update
* promotion campaign

---

### AI Enhancement (later)

* best send time
* smart segmentation
* auto follow-up

---

## Definition of Done

* campaign can be created
* recipients generated correctly
* queue sends messages
* rate limiting works
* status tracking works
* pause/resume works
* replies go back to CRM
* no duplicate sending
* system stable under large volume

---

## Final Design Insight

This module should be treated as:

> **Messaging Engine Layer (not just blast feature)**