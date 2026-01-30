import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/client.js";
import { members } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { config } from "../../config.js";
import type { BotCommand } from "./index.js";

export const verifyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Get a link to verify your RSI account"),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    // Check if already verified
    const existing = db
      .select()
      .from(members)
      .where(and(eq(members.discordId, userId), eq(members.guildId, guildId)))
      .get();

    if (existing?.status === "verified") {
      await interaction.reply({
        content: `You're already verified as **${existing.rsiHandle}**.`,
        ephemeral: true,
      });
      return;
    }

    // Create member record if doesn't exist
    if (!existing) {
      db.insert(members)
        .values({
          discordId: userId,
          guildId: guildId,
          joinedAt: new Date().toISOString(),
          status: "pending",
        })
        .run();
    }

    const verifyUrl = `${config.uci.redirectUri.replace("/auth/callback", "")}/auth/start?guild=${guildId}&user=${userId}`;

    const embed = new EmbedBuilder()
      .setTitle("RSI Account Verification")
      .setDescription(
        "Click the button below to link your Roberts Space Industries account."
      )
      .setColor(0x00aaff);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Verify RSI Account")
        .setStyle(ButtonStyle.Link)
        .setURL(verifyUrl)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};
