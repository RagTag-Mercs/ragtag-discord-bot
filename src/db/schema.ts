import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordId: text("discord_id").notNull(),
  guildId: text("guild_id").notNull(),
  rsiHandle: text("rsi_handle"),
  citizenRecord: text("citizen_record"),
  rsiOrgs: text("rsi_orgs"), // JSON array
  rsiAccountCreated: text("rsi_account_created"),
  verifiedAt: text("verified_at"),
  joinedAt: text("joined_at").notNull(),
  kickedAt: text("kicked_at"),
  status: text("status", {
    enum: ["pending", "verified", "kicked", "flagged"],
  })
    .notNull()
    .default("pending"),
});

export const guildConfig = sqliteTable("guild_config", {
  guildId: text("guild_id").primaryKey(),
  timeoutHours: integer("timeout_hours").notNull().default(72),
  blocklist: text("blocklist").default("[]"), // JSON array of org tags
  logChannelId: text("log_channel_id"),
  verifiedRoleId: text("verified_role_id"),
  // Call-to-arms feature: move members to VC when role is mentioned
  callToArmsRoleId: text("call_to_arms_role_id"), // Role that triggers the move
  callToArmsChannelId: text("call_to_arms_channel_id"), // Voice channel to move to
  callToArmsAllowedRoles: text("call_to_arms_allowed_roles").default("[]"), // JSON array of role IDs allowed to trigger
  callToArmsTriggerChannels: text("call_to_arms_trigger_channels").default("[]"), // JSON array of text channel IDs that can trigger
  // Feature toggles (1 = enabled, 0 = disabled)
  verificationEnabled: integer("verification_enabled").notNull().default(0),
  callToArmsEnabled: integer("call_to_arms_enabled").notNull().default(1),
});

export const oauthState = sqliteTable("oauth_state", {
  state: text("state").primaryKey(),
  discordId: text("discord_id").notNull(),
  guildId: text("guild_id").notNull(),
  createdAt: text("created_at").notNull(),
});
