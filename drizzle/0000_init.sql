CREATE TABLE `ai_bots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`api_key` text,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`handler_type` text DEFAULT 'direct' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blast_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`message_template` text NOT NULL,
	`wa_session_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_recipients` integer DEFAULT 0 NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`delay_seconds` integer DEFAULT 3 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blast_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`phone` text NOT NULL,
	`name` text,
	`variables` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`error` text,
	`sent_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_blast_recipients_campaign_status` ON `blast_recipients` (`campaign_id`,`status`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_number` text NOT NULL,
	`name` text,
	`ai_enabled` integer DEFAULT false NOT NULL,
	`ai_bot_id` text,
	`wa_session_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_phone_number_unique` ON `contacts` (`phone_number`);--> statement-breakpoint
CREATE INDEX `idx_contacts_wa_session` ON `contacts` (`wa_session_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`wa_session_id` text,
	`bot_id` text,
	`mode` text DEFAULT 'human' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`last_message_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_contact` ON `conversations` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_status` ON `conversations` (`status`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_conversations_open` ON `conversations` (`contact_id`,`status`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`provider` text DEFAULT 'waha' NOT NULL,
	`provider_message_id` text,
	`direction` text NOT NULL,
	`sender_type` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_contact` ON `messages` (`contact_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_messages_provider_message_id` ON `messages` (`provider`,`provider_message_id`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`auto_reply_enabled` integer DEFAULT false NOT NULL,
	`default_bot_id` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wa_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_name` text NOT NULL,
	`provider` text DEFAULT 'waha' NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_connected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
