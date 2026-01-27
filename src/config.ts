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
    clientId: required("CLIENT_ID"),
    guildId: required("GUILD_ID"),
  },
  uci: {
    clientId: required("UCI_CLIENT_ID"),
    clientSecret: required("UCI_CLIENT_SECRET"),
    redirectUri:
      process.env.UCI_REDIRECT_URI ?? "http://localhost:3000/auth/callback",
  },
  database: {
    path: process.env.DATABASE_PATH ?? "./data/bot.db",
  },
  port: parseInt(process.env.PORT ?? "3000", 10),
} as const;
