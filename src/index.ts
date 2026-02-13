import { config } from "./config.js";
import { createDiscordClient } from "./discord/client.js";
import { createHttpServer } from "./oauth/router.js";
import { db, migrate } from "./db/client.js";
import { startTimeoutChecker } from "./jobs/timeoutChecker.js";
import pino from "pino";

export const logger = pino({ name: "ragtag-bot", level: process.env.LOG_LEVEL ?? "info" });

async function main() {
  logger.info("Starting ragtag-discord-bot...");

  migrate();
  logger.info("Database migrations applied");

  const discord = createDiscordClient();
  await discord.login(config.discord.token);

  const http = createHttpServer(discord);
  await http.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`HTTP server listening on port ${config.port}`);

  startTimeoutChecker(discord);
  logger.info("Timeout checker started");
}

main().catch((err) => {
  logger.fatal(err, "Failed to start bot");
  process.exit(1);
});
