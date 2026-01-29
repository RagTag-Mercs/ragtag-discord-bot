import Fastify from "fastify";
import type { Client, TextChannel } from "discord.js";
import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { oauthState, members, guildConfig } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { getAuthorizeUrl, exchangeCode, fetchProfile } from "./uci.js";
import { checkBlocklist } from "../rsi/profile.js";
import { logger } from "../index.js";

export function createHttpServer(discord: Client) {
  const app = Fastify({ logger: false });

  app.get<{
    Querystring: { guild: string; user: string };
  }>("/auth/start", async (request, reply) => {
    const { guild, user } = request.query;

    if (!guild || !user) {
      return reply.status(400).send("Missing guild or user parameter");
    }

    const state = randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    db.insert(oauthState)
      .values({ state, discordId: user, guildId: guild, createdAt: now })
      .run();

    const url = getAuthorizeUrl(state);
    return reply.redirect(url);
  });

  app.get<{
    Querystring: { code: string; state: string };
  }>("/auth/callback", async (request, reply) => {
    const { code, state } = request.query;

    if (!code || !state) {
      return reply.status(400).send("Missing code or state parameter");
    }

    // Validate state
    const stateRecord = db
      .select()
      .from(oauthState)
      .where(eq(oauthState.state, state))
      .get();

    if (!stateRecord) {
      return reply.status(400).send("Invalid or expired state");
    }

    // Check state expiry (10 minutes)
    const stateAge =
      Date.now() - new Date(stateRecord.createdAt).getTime();
    if (stateAge > 10 * 60 * 1000) {
      db.delete(oauthState).where(eq(oauthState.state, state)).run();
      return reply.status(400).send("Verification link expired. Please request a new one from the server.");
    }

    // Clean up used state
    db.delete(oauthState).where(eq(oauthState.state, state)).run();

    try {
      const accessToken = await exchangeCode(code);
      const profile = await fetchProfile(accessToken);

      const now = new Date().toISOString();
      const orgsJson = JSON.stringify(profile.orgs);

      // Check blocklist
      const guild = db
        .select()
        .from(guildConfig)
        .where(eq(guildConfig.guildId, stateRecord.guildId))
        .get();

      const blocked = checkBlocklist(profile.orgs, guild?.blocklist ?? "[]");
      const status = blocked ? "flagged" : "verified";

      // Update member record
      db.update(members)
        .set({
          rsiHandle: profile.handle,
          citizenRecord: profile.citizenRecord,
          rsiOrgs: orgsJson,
          rsiAccountCreated: profile.accountCreated,
          verifiedAt: now,
          status,
        })
        .where(
          and(
            eq(members.discordId, stateRecord.discordId),
            eq(members.guildId, stateRecord.guildId)
          )
        )
        .run();

      // Assign verified role if configured and not flagged
      const discordGuild = await discord.guilds.fetch(stateRecord.guildId);
      const discordMember = await discordGuild.members.fetch(
        stateRecord.discordId
      );

      if (status === "verified" && guild?.verifiedRoleId) {
        await discordMember.roles.add(guild.verifiedRoleId);
      }

      // DM the user
      try {
        if (status === "flagged") {
          await discordMember.send(
            `Your RSI account **${profile.handle}** has been linked, but your membership has been **flagged** for moderator review due to org membership. Please wait for a moderator to approve your access.`
          );
        } else {
          await discordMember.send(
            `Your RSI account **${profile.handle}** has been verified! You now have full access to **${discordGuild.name}**.`
          );
        }
      } catch {
        logger.warn(
          { discordId: stateRecord.discordId },
          "Could not DM member after verification"
        );
      }

      // Log to channel
      if (guild?.logChannelId) {
        try {
          const logChannel = (await discordGuild.channels.fetch(
            guild.logChannelId
          )) as TextChannel;
          const orgList =
            profile.orgs.map((o) => `${o.name} [${o.tag}]`).join(", ") ||
            "None";
          await logChannel.send(
            `**${status === "flagged" ? "⚠️ FLAGGED" : "✅ Verified"}**: <@${stateRecord.discordId}> → RSI: **${profile.handle}** (Record #${profile.citizenRecord})\nOrgs: ${orgList}\nAccount created: ${profile.accountCreated}`
          );
        } catch {
          logger.warn("Could not send verification log message");
        }
      }

      return reply
        .type("text/html")
        .send(
          `<html><body style="font-family:sans-serif;text-align:center;padding:2em">` +
            `<h1>${status === "flagged" ? "⚠️ Flagged for Review" : "✅ Verified!"}</h1>` +
            `<p>RSI account <strong>${profile.handle}</strong> has been linked to your Discord account.</p>` +
            `${status === "flagged" ? "<p>Your membership has been flagged for moderator review.</p>" : "<p>You now have full access to the server. You can close this tab.</p>"}` +
            `</body></html>`
        );
    } catch (err) {
      logger.error(err, "OAuth callback failed");
      return reply
        .status(500)
        .type("text/html")
        .send(
          `<html><body style="font-family:sans-serif;text-align:center;padding:2em">` +
            `<h1>Verification Failed</h1>` +
            `<p>Something went wrong during verification. Please try again or contact a server moderator.</p>` +
            `</body></html>`
        );
    }
  });

  return app;
}
