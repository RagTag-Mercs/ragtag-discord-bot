import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type GuildMember,
} from "discord.js";
import { db } from "../../db/client.js";
import { members, guildConfig } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { config } from "../../config.js";
import { logger } from "../../index.js";

export async function onGuildMemberAdd(member: GuildMember) {
  const now = new Date().toISOString();

  // Upsert member record (they may have been kicked and rejoined)
  const existing = db
    .select()
    .from(members)
    .where(
      and(
        eq(members.discordId, member.id),
        eq(members.guildId, member.guild.id)
      )
    )
    .get();

  if (existing) {
    db.update(members)
      .set({ status: "pending", joinedAt: now, kickedAt: null })
      .where(eq(members.id, existing.id))
      .run();
  } else {
    db.insert(members)
      .values({
        discordId: member.id,
        guildId: member.guild.id,
        joinedAt: now,
        status: "pending",
      })
      .run();
  }

  // Get guild config for timeout info
  const guild = db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, member.guild.id))
    .get();

  // If verification is disabled, don't send the DM
  if (guild && !guild.verificationEnabled) {
    logger.info(
      { discordId: member.id, guild: member.guild.id },
      "Verification disabled, skipping DM to new member"
    );
    return;
  }

  const timeoutHours = guild?.timeoutHours ?? 72;

  const verifyUrl = `${config.uci.redirectUri.replace("/auth/callback", "")}/auth/start?guild=${member.guild.id}&user=${member.id}`;

  const embed = new EmbedBuilder()
    .setTitle("Welcome! RSI Account Verification Required")
    .setDescription(
      `To access **${member.guild.name}**, you need to link your Roberts Space Industries account.\n\n` +
        `Click the button below to verify your RSI identity. ` +
        `You have **${timeoutHours} hours** to complete verification before being removed from the server.\n\n` +
        `If you have any issues, contact a server moderator.`
    )
    .setColor(0x00aaff);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Verify RSI Account")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl)
  );

  try {
    await member.send({ embeds: [embed], components: [row] });
    logger.info(
      { discordId: member.id, guild: member.guild.id },
      "Sent verification DM to new member"
    );
  } catch {
    logger.warn(
      { discordId: member.id, guild: member.guild.id },
      "Could not DM new member (DMs may be disabled)"
    );
  }
}
