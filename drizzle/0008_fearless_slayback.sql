ALTER TABLE `ai_usage` ADD `message_id` text;--> statement-breakpoint
CREATE INDEX `idx_ai_usage_message` ON `ai_usage` (`message_id`);