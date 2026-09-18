# Enquiry workflow

1. WhatsApp delivers a message; the system deduplicates and stores it.
2. A new contact is created when needed. A new conversation copies the customer’s agent
   preference and applies the global policy to its starting reply mode.
3. Eligible customer messages open or extend a reply window, grouping a burst into one response.
4. The system checks global policy and conversation ownership, chooses the thread’s agent
   or workspace fallback, and reads outstanding customer input and context.
5. That configured agent generates a response using its own instructions and allowed tools.
6. Before further model/tool work and sending, responsibility and configuration are rechecked.
   Takeover or an agent switch suppresses obsolete generation.
7. The response is recorded and sent through the conversation’s WhatsApp number. Sent means
   accepted by the gateway; delivery or a resolved enquiry is not confirmed.

## Setup order

Prepare an AI connection and connect WhatsApp. Create the agents needed for your customer
groups, preview each, assign customers or a workspace default, then enable the intended
reply policy. Staff focus on Inbox; owners check estimated time and costs on Dashboard.

Takeover affects one thread. Marking it Done closes it; a later enquiry starts another
using the customer’s then-current preference. A send or external action already in progress
can finish after takeover and cannot be recalled by this application.
