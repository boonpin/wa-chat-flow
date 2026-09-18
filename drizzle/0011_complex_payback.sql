CREATE TABLE `business_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text,
	`business_name` text NOT NULL,
	`opening_hours` text NOT NULL,
	`services` text NOT NULL,
	`common_questions` text NOT NULL,
	`language` text NOT NULL,
	`handoff_rules` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_conversation` ON `conversation_events` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_contact` ON `conversation_events` (`contact_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `reply_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `ai_reply_started_at` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `reply_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `subscription_cost_minor` integer;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `other_monthly_cost_minor` integer;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `billing_anchor` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `ai_cost_included` integer DEFAULT false NOT NULL;