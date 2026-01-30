import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discord: {
    token: required("DISCORD_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    guildId: required("DISCORD_GUILD_ID"),
    superadminIds: (process.env.DISCORD_SUPERADMIN_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  },
  uci: {
    clientId: required("UCI_CLIENT_ID"),
    clientSecret: required("UCI_CLIENT_SECRET"),
    redirectUri:
      process.env.UCI_REDIRECT_URI ?? "http://localhost:3003/auth/callback",
  },
  database: {
    path: process.env.DATABASE_PATH ?? "./data/bot.db",
  },
  port: parseInt(process.env.PORT ?? "3003", 10),
} as const;
