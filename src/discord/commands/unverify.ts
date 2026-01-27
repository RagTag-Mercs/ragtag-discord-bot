import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/client.js";
import { members, guildConfig } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { BotCommand } from "./index.js";

export const unverifyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unverify")
    .setDescription("Remove verification from a member (forces re-verify)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("member")
        .setDescription("Member to unverify")
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const user = interaction.options.getUser("member", true);

    const record = db
      .select()
      .from(members)
      .where(and(eq(members.discordId, user.id), eq(members.guildId, guildId)))
      .get();

    if (!record) {
      await interaction.reply({
        content: "No record found for that member.",
        ephemeral: true,
      });
      return;
    }

    // Reset to pending
    db.update(members)
      .set({
        status: "pending",
        rsiHandle: null,
        citizenRecord: null,
        rsiOrgs: null,
        rsiAccountCreated: null,
        verifiedAt: null,
        joinedAt: new Date().toISOString(), // Reset timeout clock
      })
      .where(eq(members.id, record.id))
      .run();

    // Remove verified role if configured
    const guild = db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .get();

    if (guild?.verifiedRoleId) {
      try {
        const discordGuild = await interaction.guild!.members.fetch(user.id);
        await discordGuild.roles.remove(guild.verifiedRoleId);
      } catch {
        // Member may have left
      }
    }

    await interaction.reply({
      content: `Verification removed for <@${user.id}>. They will need to re-verify their RSI account.`,
      ephemeral: true,
    });
  },
};
