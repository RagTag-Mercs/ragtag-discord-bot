import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/client.js";
import { members } from "../../db/schema.js";
import { eq, and, count } from "drizzle-orm";
import type { BotCommand } from "./index.js";

export const statsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show verification statistics")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;

    const verified = db
      .select({ count: count() })
      .from(members)
      .where(
        and(eq(members.guildId, guildId), eq(members.status, "verified"))
      )
      .get()!.count;

    const pending = db
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.status, "pending")))
      .get()!.count;

    const kicked = db
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.status, "kicked")))
      .get()!.count;

    const flagged = db
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.status, "flagged")))
      .get()!.count;

    const total = verified + pending + kicked + flagged;

    const embed = new EmbedBuilder()
      .setTitle("Verification Statistics")
      .setColor(0x00aaff)
      .addFields(
        { name: "Total Members Tracked", value: String(total), inline: true },
        { name: "Verified", value: `${verified}`, inline: true },
        { name: "Pending", value: `${pending}`, inline: true },
        { name: "Kicked", value: `${kicked}`, inline: true },
        { name: "Flagged", value: `${flagged}`, inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
