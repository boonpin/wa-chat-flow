-- The auto-reply switch becomes a three-way policy: 'all', 'existing', 'off'.
-- A workspace that had the switch on was answering everything, so it maps to
-- 'all'; the new column's default already covers the off case.
ALTER TABLE `system_settings` ADD `auto_reply_mode` text DEFAULT 'off' NOT NULL;--> statement-breakpoint
UPDATE `system_settings` SET `auto_reply_mode` = 'all' WHERE `auto_reply_enabled` = 1;--> statement-breakpoint
ALTER TABLE `system_settings` DROP COLUMN `auto_reply_enabled`;
