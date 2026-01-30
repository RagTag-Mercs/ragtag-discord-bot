ALTER TABLE `guild_config` ADD `call_to_arms_trigger_channels` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `guild_config` ADD `verification_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `guild_config` ADD `call_to_arms_enabled` integer DEFAULT 1 NOT NULL;