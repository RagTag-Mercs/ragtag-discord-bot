import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/client.js";
import { guildConfig } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { BotCommand } from "./index.js";
import { config } from "../../config.js";
import { logger } from "../../index.js";

function getOrCreateConfig(guildId: string) {
  let guild = db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, guildId))
    .get();

  if (!guild) {
    db.insert(guildConfig).values({ guildId }).run();
    guild = db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .get()!;
  }

  return guild;
}

export const configCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure bot settings")
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Set verification timeout in hours")
        .addIntegerOption((opt) =>
          opt
            .setName("hours")
            .setDescription("Number of hours before kicking unverified members")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(720)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("log-channel")
        .setDescription("Set the channel for verification logs")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Log channel").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("verified-role")
        .setDescription("Set the role assigned to verified members")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to assign on verification")
            .setRequired(true)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("blocklist")
        .setDescription("Manage the RSI org blocklist")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add an RSI org tag to the blocklist")
            .addStringOption((opt) =>
              opt
                .setName("tag")
                .setDescription("RSI org tag (e.g. GNET)")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove an RSI org tag from the blocklist")
            .addStringOption((opt) =>
              opt
                .setName("tag")
                .setDescription("RSI org tag to remove")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("Show the current blocklist")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("call-to-arms")
        .setDescription("Configure the call-to-arms voice channel move feature")
        .addSubcommand((sub) =>
          sub
            .setName("role")
            .setDescription("Set the role that triggers the move when mentioned")
            .addRoleOption((opt) =>
              opt
                .setName("role")
                .setDescription("The role to monitor for mentions")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("channel")
            .setDescription("Set the voice channel to move members to")
            .addChannelOption((opt) =>
              opt
                .setName("channel")
                .setDescription("The target voice channel")
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("allow-role")
            .setDescription("Add a role that can trigger call-to-arms")
            .addRoleOption((opt) =>
              opt
                .setName("role")
                .setDescription("Role to allow (e.g. Officers)")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("deny-role")
            .setDescription("Remove a role from triggering call-to-arms")
            .addRoleOption((opt) =>
              opt
                .setName("role")
                .setDescription("Role to remove")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("allow-trigger-channel")
            .setDescription("Add a text channel that can trigger call-to-arms")
            .addChannelOption((opt) =>
              opt
                .setName("channel")
                .setDescription("Text channel to allow")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("deny-trigger-channel")
            .setDescription("Remove a text channel from triggering call-to-arms")
            .addChannelOption((opt) =>
              opt
                .setName("channel")
                .setDescription("Text channel to remove")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("status")
            .setDescription("Show call-to-arms configuration")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Show current configuration")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("feature")
        .setDescription("Enable or disable bot features")
        .addSubcommand((sub) =>
          sub
            .setName("enable")
            .setDescription("Enable a bot feature")
            .addStringOption((opt) =>
              opt
                .setName("name")
                .setDescription("Feature to enable")
                .setRequired(true)
                .addChoices(
                  { name: "verification", value: "verification" },
                  { name: "call-to-arms", value: "call-to-arms" }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("disable")
            .setDescription("Disable a bot feature")
            .addStringOption((opt) =>
              opt
                .setName("name")
                .setDescription("Feature to disable")
                .setRequired(true)
                .addChoices(
                  { name: "verification", value: "verification" },
                  { name: "call-to-arms", value: "call-to-arms" }
                )
            )
        )
        .addSubcommand((sub) =>
          sub.setName("status").setDescription("Show feature status")
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const member = interaction.member;
    const subGroup = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    logger.info(
      {
        userId: interaction.user.id,
        username: interaction.user.username,
        guildId,
        command: subGroup ? `${subGroup} ${sub}` : sub,
      },
      "/config command invoked"
    );

    // Check permissions: Superadmin, Administrator, OR "Council Member" role
    const isSuperadmin = config.discord.superadminIds.includes(
      interaction.user.id
    );
    const isAdmin =
      member &&
      typeof member.permissions !== "string" &&
      member.permissions.has(PermissionFlagsBits.Administrator);
    const hasCouncilRole =
      member &&
      "cache" in member.roles &&
      member.roles.cache.some((role) => role.name === "Council Member");

    if (!isSuperadmin && !isAdmin && !hasCouncilRole) {
      await interaction.reply({
        content:
          "You need Administrator permission or the Council Member role to use this command.",
        ephemeral: true,
      });
      return;
    }

    if (subGroup === "blocklist") {
      const config = getOrCreateConfig(guildId);
      const blocklist: string[] = JSON.parse(config.blocklist ?? "[]");

      if (sub === "add") {
        const tag = interaction.options.getString("tag", true).toUpperCase();
        if (blocklist.includes(tag)) {
          await interaction.reply({
            content: `\`${tag}\` is already on the blocklist.`,
            ephemeral: true,
          });
          return;
        }
        blocklist.push(tag);
        db.update(guildConfig)
          .set({ blocklist: JSON.stringify(blocklist) })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `Added \`${tag}\` to the blocklist.`,
          ephemeral: true,
        });
      } else if (sub === "remove") {
        const tag = interaction.options.getString("tag", true).toUpperCase();
        const idx = blocklist.indexOf(tag);
        if (idx === -1) {
          await interaction.reply({
            content: `\`${tag}\` is not on the blocklist.`,
            ephemeral: true,
          });
          return;
        }
        blocklist.splice(idx, 1);
        db.update(guildConfig)
          .set({ blocklist: JSON.stringify(blocklist) })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `Removed \`${tag}\` from the blocklist.`,
          ephemeral: true,
        });
      } else if (sub === "list") {
        await interaction.reply({
          content:
            blocklist.length > 0
              ? `**Blocklist**: ${blocklist.map((t) => `\`${t}\``).join(", ")}`
              : "The blocklist is empty.",
          ephemeral: true,
        });
      }
      return;
    }

    if (subGroup === "call-to-arms") {
      const config = getOrCreateConfig(guildId);

      if (sub === "role") {
        const role = interaction.options.getRole("role", true);
        db.update(guildConfig)
          .set({ callToArmsRoleId: role.id })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `Call-to-arms will trigger when **${role.name}** is mentioned.`,
          ephemeral: true,
        });
      } else if (sub === "channel") {
        const channel = interaction.options.getChannel("channel", true);
        db.update(guildConfig)
          .set({ callToArmsChannelId: channel.id })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `Call-to-arms will move members to <#${channel.id}>.`,
          ephemeral: true,
        });
      } else if (sub === "allow-role") {
        const role = interaction.options.getRole("role", true);
        const allowedRoles: string[] = JSON.parse(
          config.callToArmsAllowedRoles ?? "[]"
        );
        if (allowedRoles.includes(role.id)) {
          await interaction.reply({
            content: `**${role.name}** can already trigger call-to-arms.`,
            ephemeral: true,
          });
          return;
        }
        allowedRoles.push(role.id);
        db.update(guildConfig)
          .set({ callToArmsAllowedRoles: JSON.stringify(allowedRoles) })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `**${role.name}** can now trigger call-to-arms.`,
          ephemeral: true,
        });
      } else if (sub === "deny-role") {
        const role = interaction.options.getRole("role", true);
        const allowedRoles: string[] = JSON.parse(
          config.callToArmsAllowedRoles ?? "[]"
        );
        const idx = allowedRoles.indexOf(role.id);
        if (idx === -1) {
          await interaction.reply({
            content: `**${role.name}** is not in the allowed list.`,
            ephemeral: true,
          });
          return;
        }
        allowedRoles.splice(idx, 1);
        db.update(guildConfig)
          .set({ callToArmsAllowedRoles: JSON.stringify(allowedRoles) })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `**${role.name}** can no longer trigger call-to-arms.`,
          ephemeral: true,
        });
      } else if (sub === "allow-trigger-channel") {
        const channel = interaction.options.getChannel("channel", true);
        const triggerChannels: string[] = JSON.parse(
          config.callToArmsTriggerChannels ?? "[]"
        );
        if (triggerChannels.includes(channel.id)) {
          await interaction.reply({
            content: `<#${channel.id}> can already trigger call-to-arms.`,
            ephemeral: true,
          });
          return;
        }
        triggerChannels.push(channel.id);
        db.update(guildConfig)
          .set({ callToArmsTriggerChannels: JSON.stringify(triggerChannels) })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `<#${channel.id}> can now trigger call-to-arms.`,
          ephemeral: true,
        });
      } else if (sub === "deny-trigger-channel") {
        const channel = interaction.options.getChannel("channel", true);
        const triggerChannels: string[] = JSON.parse(
          config.callToArmsTriggerChannels ?? "[]"
        );
        const idx = triggerChannels.indexOf(channel.id);
        if (idx === -1) {
          await interaction.reply({
            content: `<#${channel.id}> is not in the allowed trigger channels list.`,
            ephemeral: true,
          });
          return;
        }
        triggerChannels.splice(idx, 1);
        db.update(guildConfig)
          .set({ callToArmsTriggerChannels: JSON.stringify(triggerChannels) })
          .where(eq(guildConfig.guildId, guildId))
          .run();
        await interaction.reply({
          content: `<#${channel.id}> can no longer trigger call-to-arms.`,
          ephemeral: true,
        });
      } else if (sub === "status") {
        const allowedRoles: string[] = JSON.parse(
          config.callToArmsAllowedRoles ?? "[]"
        );
        const triggerChannels: string[] = JSON.parse(
          config.callToArmsTriggerChannels ?? "[]"
        );
        await interaction.reply({
          content: [
            "**Call-to-Arms Configuration**",
            `Status: ${config.callToArmsEnabled === 0 ? "🚫 Disabled" : "✅ Enabled"}`,
            `Trigger role: ${config.callToArmsRoleId ? `<@&${config.callToArmsRoleId}>` : "Not set"}`,
            `Target channel: ${config.callToArmsChannelId ? `<#${config.callToArmsChannelId}>` : "Not set"}`,
            `Allowed roles: ${allowedRoles.length > 0 ? allowedRoles.map((r) => `<@&${r}>`).join(", ") : "None (disabled)"}`,
            `Trigger channels: ${triggerChannels.length > 0 ? triggerChannels.map((c) => `<#${c}>`).join(", ") : "None (disabled)"}`,
          ].join("\n"),
          ephemeral: true,
        });
      }
      return;
    }

    if (subGroup === "feature") {
      const config = getOrCreateConfig(guildId);

      if (sub === "enable") {
        const feature = interaction.options.getString("name", true);
        if (feature === "verification") {
          db.update(guildConfig)
            .set({ verificationEnabled: 1 })
            .where(eq(guildConfig.guildId, guildId))
            .run();
          await interaction.reply({
            content: "✅ **Verification** is now **enabled**. New members will receive verification DMs.",
            ephemeral: true,
          });
        } else if (feature === "call-to-arms") {
          db.update(guildConfig)
            .set({ callToArmsEnabled: 1 })
            .where(eq(guildConfig.guildId, guildId))
            .run();
          await interaction.reply({
            content: "✅ **Call-to-arms** is now **enabled**. Mentioning the trigger role will move members.",
            ephemeral: true,
          });
        }
      } else if (sub === "disable") {
        const feature = interaction.options.getString("name", true);
        if (feature === "verification") {
          db.update(guildConfig)
            .set({ verificationEnabled: 0 })
            .where(eq(guildConfig.guildId, guildId))
            .run();
          await interaction.reply({
            content: "🚫 **Verification** is now **disabled**. New members will not receive verification DMs or be kicked for timeout.",
            ephemeral: true,
          });
        } else if (feature === "call-to-arms") {
          db.update(guildConfig)
            .set({ callToArmsEnabled: 0 })
            .where(eq(guildConfig.guildId, guildId))
            .run();
          await interaction.reply({
            content: "🚫 **Call-to-arms** is now **disabled**. Mentioning the trigger role will have no effect.",
            ephemeral: true,
          });
        }
      } else if (sub === "status") {
        await interaction.reply({
          content: [
            "**Feature Status**",
            `Verification: ${config.verificationEnabled ? "✅ Enabled" : "🚫 Disabled"}`,
            `Call-to-arms: ${config.callToArmsEnabled === 0 ? "🚫 Disabled" : "✅ Enabled"}`,
          ].join("\n"),
          ephemeral: true,
        });
      }
      return;
    }

    if (sub === "timeout") {
      const hours = interaction.options.getInteger("hours", true);
      getOrCreateConfig(guildId);
      db.update(guildConfig)
        .set({ timeoutHours: hours })
        .where(eq(guildConfig.guildId, guildId))
        .run();
      await interaction.reply({
        content: `Verification timeout set to **${hours} hours**.`,
        ephemeral: true,
      });
    } else if (sub === "log-channel") {
      const channel = interaction.options.getChannel("channel", true);
      getOrCreateConfig(guildId);
      db.update(guildConfig)
        .set({ logChannelId: channel.id })
        .where(eq(guildConfig.guildId, guildId))
        .run();
      await interaction.reply({
        content: `Verification logs will be sent to <#${channel.id}>.`,
        ephemeral: true,
      });
    } else if (sub === "verified-role") {
      const role = interaction.options.getRole("role", true);
      getOrCreateConfig(guildId);
      db.update(guildConfig)
        .set({ verifiedRoleId: role.id })
        .where(eq(guildConfig.guildId, guildId))
        .run();
      await interaction.reply({
        content: `Verified members will receive the **${role.name}** role.`,
        ephemeral: true,
      });
    } else if (sub === "show") {
      const config = getOrCreateConfig(guildId);
      const blocklist: string[] = JSON.parse(config.blocklist ?? "[]");
      const ctaAllowed: string[] = JSON.parse(
        config.callToArmsAllowedRoles ?? "[]"
      );
      const ctaTriggerChannels: string[] = JSON.parse(
        config.callToArmsTriggerChannels ?? "[]"
      );
      await interaction.reply({
        content: [
          "**Bot Configuration**",
          `Timeout: **${config.timeoutHours}** hours`,
          `Log channel: ${config.logChannelId ? `<#${config.logChannelId}>` : "Not set"}`,
          `Verified role: ${config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : "Not set"}`,
          `Blocklist: ${blocklist.length > 0 ? blocklist.map((t) => `\`${t}\``).join(", ") : "Empty"}`,
          "",
          "**Features**",
          `Verification: ${config.verificationEnabled ? "✅ Enabled" : "🚫 Disabled"}`,
          `Call-to-arms: ${config.callToArmsEnabled === 0 ? "🚫 Disabled" : "✅ Enabled"}`,
          "",
          "**Call-to-Arms Settings**",
          `Trigger role: ${config.callToArmsRoleId ? `<@&${config.callToArmsRoleId}>` : "Not set"}`,
          `Target channel: ${config.callToArmsChannelId ? `<#${config.callToArmsChannelId}>` : "Not set"}`,
          `Allowed roles: ${ctaAllowed.length > 0 ? ctaAllowed.map((r) => `<@&${r}>`).join(", ") : "None"}`,
          `Trigger channels: ${ctaTriggerChannels.length > 0 ? ctaTriggerChannels.map((c) => `<#${c}>`).join(", ") : "None"}`,
        ].join("\n"),
        ephemeral: true,
      });
    }
  },
};
