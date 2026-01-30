import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { configCommand } from "./config.js";
import { lookupCommand } from "./lookup.js";
import { unverifyCommand } from "./unverify.js";
import { statsCommand } from "./stats.js";
import { verifyCommand } from "./verify.js";

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: BotCommand[] = [
  configCommand,
  lookupCommand,
  unverifyCommand,
  statsCommand,
  verifyCommand,
];
