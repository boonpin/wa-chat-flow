CREATE TABLE `bot_tools` (
	`bot_id` text NOT NULL,
	`tool_id` text NOT NULL,
	PRIMARY KEY(`bot_id`, `tool_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_bot_tools_bot` ON `bot_tools` (`bot_id`);--> statement-breakpoint
CREATE TABLE `tool_invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`args` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`synced_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_tool_invocations_conversation` ON `tool_invocations` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_invocations_status` ON `tool_invocations` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'sheet_capture' NOT NULL,
	`description` text NOT NULL,
	`sink_type` text DEFAULT 'apps_script' NOT NULL,
	`sink_url` text,
	`sink_secret` text,
	`spreadsheet_url` text,
	`sheet_tab` text DEFAULT 'Sheet1' NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tools_name_unique` ON `tools` (`name`);