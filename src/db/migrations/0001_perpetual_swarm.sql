ALTER TABLE `guild_config` ADD `call_to_arms_role_id` text;--> statement-breakpoint
ALTER TABLE `guild_config` ADD `call_to_arms_channel_id` text;--> statement-breakpoint
ALTER TABLE `guild_config` ADD `call_to_arms_allowed_roles` text DEFAULT '[]';