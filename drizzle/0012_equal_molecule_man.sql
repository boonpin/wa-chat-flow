ALTER TABLE `ai_usage` ADD `usage_known` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE ai_usage SET usage_known = 1 WHERE input_tokens > 0 OR output_tokens > 0 OR total_tokens > 0;
--> statement-breakpoint
-- Preserve inherited assistant bindings before separating future contact defaults.
UPDATE conversations SET bot_id = (SELECT ai_bot_id FROM contacts WHERE contacts.id = conversations.contact_id)
WHERE bot_id IS NULL AND EXISTS (SELECT 1 FROM contacts WHERE contacts.id = conversations.contact_id AND ai_bot_id IS NOT NULL);
