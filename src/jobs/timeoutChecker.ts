import type { Client, TextChannel } from "discord.js";
import { db } from "../db/client.js";
import { members, guildConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../index.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startTimeoutChecker(client: Client) {
  setInterval(() => checkTimeouts(client), CHECK_INTERVAL_MS);
  // Run once on startup after a short delay
  setTimeout(() => checkTimeouts(client), 5000);
}

async function checkTimeouts(client: Client) {
  const pendingMembers = db
    .select()
    .from(members)
    .where(eq(members.status, "pending"))
    .all();

  if (pendingMembers.length === 0) return;

  // Group by guild for config lookup
  const byGuild = new Map<string, typeof pendingMembers>();
  for (const m of pendingMembers) {
    const list = byGuild.get(m.guildId) ?? [];
    list.push(m);
    byGuild.set(m.guildId, list);
  }

  for (const [guildId, guildMembers] of byGuild) {
    const guild = db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .get();

    const timeoutMs = (guild?.timeoutHours ?? 72) * 60 * 60 * 1000;
    const now = Date.now();

    let discordGuild;
    try {
      discordGuild = await client.guilds.fetch(guildId);
    } catch {
      logger.warn({ guildId }, "Could not fetch guild for timeout check");
      continue;
    }

    for (const member of guildMembers) {
      const joinedAt = new Date(member.joinedAt).getTime();
      const elapsed = now - joinedAt;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        // Kick the member
        try {
          const discordMember = await discordGuild.members.fetch(
            member.discordId
          );

          try {
            await discordMember.send(
              `You have been removed from **${discordGuild.name}** for not completing RSI account verification within the required timeframe. You may rejoin and try again.`
            );
          } catch {
            // DMs disabled
          }

          await discordMember.kick("RSI verification timeout");

          db.update(members)
            .set({ status: "kicked", kickedAt: new Date().toISOString() })
            .where(eq(members.id, member.id))
            .run();

          logger.info(
            { discordId: member.discordId, guildId },
            "Kicked member for verification timeout"
          );

          // Log to channel
          if (guild?.logChannelId) {
            try {
              const logChannel = (await discordGuild.channels.fetch(
                guild.logChannelId
              )) as TextChannel;
              await logChannel.send(
                `**🚫 Kicked**: <@${member.discordId}> — did not verify RSI account within ${guild?.timeoutHours ?? 72} hours.`
              );
            } catch {
              // Channel unavailable
            }
          }
        } catch (err) {
          logger.warn(
            { discordId: member.discordId, guildId, err },
            "Could not kick member (may have already left)"
          );
          // If the member already left, mark as kicked
          db.update(members)
            .set({ status: "kicked", kickedAt: new Date().toISOString() })
            .where(eq(members.id, member.id))
            .run();
        }
      } else if (remaining <= 60 * 60 * 1000 && remaining > 60 * 60 * 1000 - CHECK_INTERVAL_MS) {
        // Within the last hour — send reminder (once, within the check interval window)
        try {
          const discordMember = await discordGuild.members.fetch(
            member.discordId
          );
          await discordMember.send(
            `⏰ **Reminder**: You have less than 1 hour to verify your RSI account in **${discordGuild.name}** before being removed. Check your earlier DM for the verification link.`
          );
        } catch {
          // DMs disabled or member left
        }
      }
    }
  }
}
