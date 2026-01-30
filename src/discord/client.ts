import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { config } from "../config.js";
import { onReady } from "./events/ready.js";
import { onGuildMemberAdd } from "./events/guildMemberAdd.js";
import { onInteractionCreate } from "./events/interactionCreate.js";
import { onMessageCreate } from "./events/messageCreate.js";
import { commands } from "./commands/index.js";
import { logger } from "../index.js";

export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // Required to read message content for role mentions
      GatewayIntentBits.GuildVoiceStates, // Required to move members between voice channels
    ],
  });

  client.once("ready", onReady);
  client.on("guildMemberAdd", onGuildMemberAdd);
  client.on("interactionCreate", onInteractionCreate);
  client.on("messageCreate", onMessageCreate);

  return client;
}

export async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
    commands.map((cmd) => cmd.data.toJSON());

  await rest.put(
    Routes.applicationGuildCommands(
      config.discord.clientId,
      config.discord.guildId
    ),
    { body: commandData }
  );

  logger.info(`Registered ${commandData.length} slash commands`);
}
