CREATE TABLE `guild_config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`timeout_hours` integer DEFAULT 72 NOT NULL,
	`blocklist` text DEFAULT '[]',
	`log_channel_id` text,
	`verified_role_id` text
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`rsi_handle` text,
	`citizen_record` text,
	`rsi_orgs` text,
	`rsi_account_created` text,
	`verified_at` text,
	`joined_at` text NOT NULL,
	`kicked_at` text,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_state` (
	`state` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`created_at` text NOT NULL
);
