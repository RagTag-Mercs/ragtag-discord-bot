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
});

export const oauthState = sqliteTable("oauth_state", {
  state: text("state").primaryKey(),
  discordId: text("discord_id").notNull(),
  guildId: text("guild_id").notNull(),
  createdAt: text("created_at").notNull(),
});
