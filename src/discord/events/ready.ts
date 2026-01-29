import type { Client } from "discord.js";
import { registerSlashCommands } from "../client.js";
import { logger } from "../../index.js";

export async function onReady(client: Client<true>) {
  logger.info(`Bot logged in as ${client.user.tag}`);
  await registerSlashCommands();
}
