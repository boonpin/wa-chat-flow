CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`api_key` text,
	`model` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text,
	`bot_id` text,
	`conversation_id` text,
	`kind` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`round` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`latency_ms` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_provider` ON `ai_usage` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_bot` ON `ai_usage` (`bot_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_conversation` ON `ai_usage` (`conversation_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `ai_bots` ADD `provider_id` text;--> statement-breakpoint
INSERT INTO `ai_providers` (`id`, `name`, `kind`, `api_key`, `model`, `enabled`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  CASE `provider` WHEN 'openai' THEN 'OpenAI' WHEN 'gemini' THEN 'Google Gemini' ELSE `provider` END || ' · ' || `model`,
  `provider`,
  `api_key`,
  `model`,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT DISTINCT
    `provider`,
    `api_key`,
    CASE
      WHEN `model` IS NULL OR trim(`model`) = '' THEN
        CASE `provider` WHEN 'gemini' THEN 'gemini-1.5-flash' ELSE 'gpt-4o-mini' END
      ELSE `model`
    END AS `model`
  FROM `ai_bots`
);--> statement-breakpoint
UPDATE `ai_bots` SET `provider_id` = (
  SELECT `p`.`id` FROM `ai_providers` `p`
  WHERE `p`.`kind` IS `ai_bots`.`provider`
    AND `p`.`api_key` IS `ai_bots`.`api_key`
    AND `p`.`model` IS CASE
      WHEN `ai_bots`.`model` IS NULL OR trim(`ai_bots`.`model`) = '' THEN
        CASE `ai_bots`.`provider` WHEN 'gemini' THEN 'gemini-1.5-flash' ELSE 'gpt-4o-mini' END
      ELSE `ai_bots`.`model`
    END
);
