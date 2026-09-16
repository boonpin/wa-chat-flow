CREATE TABLE `ai_model_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`model` text NOT NULL,
	`currency` text NOT NULL,
	`input_rate_micros` integer NOT NULL,
	`output_rate_micros` integer NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_model_rates_lookup` ON `ai_model_rates` (`kind`,`model`,`currency`,`effective_from`);--> statement-breakpoint
ALTER TABLE `system_settings` ADD `manual_reply_minutes` integer;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `labor_cost_minor` integer;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `report_currency` text DEFAULT 'MYR' NOT NULL;