import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/client.js";
import { guildConfig } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { BotCommand } from "./index.js";

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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Show current configuration")
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const subGroup = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

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
      await interaction.reply({
        content: [
          "**Bot Configuration**",
          `Timeout: **${config.timeoutHours}** hours`,
          `Log channel: ${config.logChannelId ? `<#${config.logChannelId}>` : "Not set"}`,
          `Verified role: ${config.verifiedRoleId ? `<@&${config.verifiedRoleId}>` : "Not set"}`,
          `Blocklist: ${blocklist.length > 0 ? blocklist.map((t) => `\`${t}\``).join(", ") : "Empty"}`,
        ].join("\n"),
        ephemeral: true,
      });
    }
  },
};
