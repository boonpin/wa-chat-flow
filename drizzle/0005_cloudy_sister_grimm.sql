ALTER TABLE `conversations` ADD `auto_reply_due_at` text;--> statement-breakpoint
CREATE INDEX `idx_conversations_reply_due` ON `conversations` (`auto_reply_due_at`);--> statement-breakpoint
ALTER TABLE `system_settings` ADD `reply_window_seconds` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `reply_max_wait_seconds` integer DEFAULT 45 NOT NULL;