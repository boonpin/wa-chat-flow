# End-to-End Workflow

## Message Handling Logic

1. Incoming WhatsApp message is received.
2. Contact is created (if new).
3. System checks global auto reply setting.
4. System checks contact AI enabled setting.
5. System chooses bot:
- Contact assigned bot
- Otherwise default bot
- Otherwise no reply
6. AI provider generates response.
7. Reply is sent to WhatsApp.

## Practical Setup Order

1. Connect WhatsApp.
2. Create at least one bot.
3. Set default bot.
4. Enable global auto reply.
5. Enable AI for selected contacts.
