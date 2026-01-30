import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/client.js";
import { members } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { BotCommand } from "./index.js";

export const lookupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up a member's RSI account info")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("discord")
        .setDescription("Look up by Discord user")
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("Discord user to look up")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rsi")
        .setDescription("Look up by RSI handle")
        .addStringOption((opt) =>
          opt
            .setName("handle")
            .setDescription("RSI handle to search for")
            .setRequired(true)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    let record;

    if (sub === "discord") {
      const user = interaction.options.getUser("member", true);
      record = db
        .select()
        .from(members)
        .where(
          and(eq(members.discordId, user.id), eq(members.guildId, guildId))
        )
        .get();
    } else {
      const handle = interaction.options.getString("handle", true);
      record = db
        .select()
        .from(members)
        .where(
          and(eq(members.rsiHandle, handle), eq(members.guildId, guildId))
        )
        .get();
    }

    if (!record) {
      await interaction.reply({
        content: "No record found for that member.",
        ephemeral: true,
      });
      return;
    }

    const orgs: { name: string; tag: string; rank: string }[] = record.rsiOrgs
      ? JSON.parse(record.rsiOrgs)
      : [];

    const orgList =
      orgs.map((o) => `${o.name} [${o.tag}] (${o.rank})`).join("\n") ||
      "None";

    const statusEmoji: Record<string, string> = {
      pending: "⏳",
      verified: "✅",
      kicked: "🚫",
      flagged: "⚠️",
    };

    const embed = new EmbedBuilder()
      .setTitle(`RSI Profile: ${record.rsiHandle ?? "Not verified"}`)
      .setColor(
        record.status === "verified"
          ? 0x00ff00
          : record.status === "flagged"
            ? 0xff9900
            : record.status === "kicked"
              ? 0xff0000
              : 0x888888
      )
      .addFields(
        {
          name: "Discord",
          value: `<@${record.discordId}>`,
          inline: true,
        },
        {
          name: "Status",
          value: `${statusEmoji[record.status] ?? ""} ${record.status}`,
          inline: true,
        },
        {
          name: "Citizen Record",
          value: record.citizenRecord ?? "N/A",
          inline: true,
        },
        {
          name: "RSI Account Created",
          value: record.rsiAccountCreated ?? "N/A",
          inline: true,
        },
        {
          name: "Verified At",
          value: record.verifiedAt ?? "N/A",
          inline: true,
        },
        { name: "Joined Server", value: record.joinedAt, inline: true },
        { name: "Organizations", value: orgList }
      );

    if (record.rsiHandle) {
      embed.setURL(
        `https://robertsspaceindustries.com/citizens/${record.rsiHandle}`
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
