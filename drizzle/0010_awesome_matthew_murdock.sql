ALTER TABLE `ai_providers` ADD `image_model` text;--> statement-breakpoint
ALTER TABLE `ai_providers` ADD `image_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_providers` ADD `voice_model` text;--> statement-breakpoint
ALTER TABLE `ai_providers` ADD `voice_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_usage` ADD `stage` text DEFAULT 'reply' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `media_url` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `media_mime` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `media_summary` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `media_status` text;