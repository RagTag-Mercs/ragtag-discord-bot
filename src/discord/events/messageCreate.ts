import type { Message } from "discord.js";
import { db } from "../../db/client.js";
import { guildConfig } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../index.js";
import { config } from "../../config.js";

export async function onMessageCreate(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Must be in a guild
  if (!message.guild) return;

  // Check if any roles were mentioned
  if (message.mentions.roles.size === 0) return;

  // Get guild config
  const guildCfg = db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, message.guild.id))
    .get();

  if (!guildCfg?.callToArmsRoleId || !guildCfg?.callToArmsChannelId) return;

  // Check if call-to-arms is enabled
  if (!guildCfg.callToArmsEnabled) return;

  // Check if the call-to-arms role was mentioned
  if (!message.mentions.roles.has(guildCfg.callToArmsRoleId)) return;

  // Check if the author has permission (superadmin or one of the allowed roles)
  const isSuperadmin = config.discord.superadminIds.includes(message.author.id);

  const allowedRoles: string[] = JSON.parse(
    guildCfg.callToArmsAllowedRoles ?? "[]"
  );

  const member = message.member;
  if (!member) {
    logger.warn(
      { userId: message.author.id, guildId: message.guild.id },
      "Call-to-arms: message.member was null"
    );
    return;
  }

  const hasRolePermission = allowedRoles.some((roleId) =>
    member.roles.cache.has(roleId)
  );

  if (!isSuperadmin && !hasRolePermission) {
    logger.info(
      { userId: message.author.id, guildId: message.guild.id },
      "User attempted call-to-arms without permission"
    );
    return;
  }

  // Check if this channel is allowed to trigger call-to-arms (deny by default)
  const triggerChannels: string[] = JSON.parse(
    guildCfg.callToArmsTriggerChannels ?? "[]"
  );

  if (!triggerChannels.includes(message.channelId)) {
    logger.info(
      {
        userId: message.author.id,
        guildId: message.guild.id,
        channelId: message.channelId,
        allowedChannels: triggerChannels,
      },
      "Call-to-arms triggered from non-allowed channel"
    );
    return;
  }

  // Get the target voice channel
  const targetChannel = message.guild.channels.cache.get(
    guildCfg.callToArmsChannelId
  );

  if (!targetChannel?.isVoiceBased()) {
    logger.warn(
      { channelId: guildCfg.callToArmsChannelId, guildId: message.guild.id },
      "Call-to-arms target channel is not a voice channel"
    );
    return;
  }

  // Find all members with the call-to-arms role who are in a voice channel
  const callToArmsRole = message.guild.roles.cache.get(guildCfg.callToArmsRoleId);
  if (!callToArmsRole) return;

  // Fetch all guild members to ensure we have the full list
  await message.guild.members.fetch();

  const membersToMove = message.guild.members.cache.filter(
    (m) =>
      m.roles.cache.has(guildCfg.callToArmsRoleId!) &&
      m.voice.channel &&
      m.voice.channel.id !== guildCfg.callToArmsChannelId
  );

  if (membersToMove.size === 0) {
    await message.reply({
      content: `No members with <@&${guildCfg.callToArmsRoleId}> are currently in voice channels to move.`,
      allowedMentions: { parse: [] },
    });
    return;
  }

  // Move all members
  let movedCount = 0;
  let failedCount = 0;

  for (const [, memberToMove] of membersToMove) {
    try {
      await memberToMove.voice.setChannel(targetChannel);
      movedCount++;
    } catch (error) {
      failedCount++;
      logger.error(
        { error, memberId: memberToMove.id, guildId: message.guild.id },
        "Failed to move member for call-to-arms"
      );
    }
  }

  logger.info(
    {
      triggeredBy: message.author.id,
      guildId: message.guild.id,
      movedCount,
      failedCount,
      targetChannel: targetChannel.name,
    },
    "Call-to-arms triggered"
  );

  await message.reply({
    content: `Moved **${movedCount}** member${movedCount !== 1 ? "s" : ""} to <#${guildCfg.callToArmsChannelId}>${failedCount > 0 ? ` (${failedCount} failed)` : ""}.`,
    allowedMentions: { parse: [] },
  });
}
