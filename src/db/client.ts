import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "../config.js";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

mkdirSync(dirname(config.database.path), { recursive: true });

const sqlite = new Database(config.database.path);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      rsi_handle TEXT,
      citizen_record TEXT,
      rsi_orgs TEXT,
      rsi_account_created TEXT,
      verified_at TEXT,
      joined_at TEXT NOT NULL,
      kicked_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      UNIQUE(discord_id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      timeout_hours INTEGER NOT NULL DEFAULT 72,
      blocklist TEXT DEFAULT '[]',
      log_channel_id TEXT,
      verified_role_id TEXT
    );

    CREATE TABLE IF NOT EXISTS oauth_state (
      state TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_members_discord_guild
      ON members(discord_id, guild_id);

    CREATE INDEX IF NOT EXISTS idx_members_status
      ON members(status);

    CREATE INDEX IF NOT EXISTS idx_members_rsi_handle
      ON members(rsi_handle);
  `);
}
