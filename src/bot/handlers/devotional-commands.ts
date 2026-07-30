import {
  ChannelType,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import { createTyndaleEmbed } from "../../citations/bible/format.js";
import type { GuildDevotionalStore } from "../../preferences/guild-devotionals.js";
import {
  runDevotionalCatchUpForGuild,
  type DevotionalSchedulerDeps,
} from "../../devotionals/scheduler.js";
import {
  filterTimezones,
  formatTimeOfDay,
  isValidTimezone,
  parseTimeOfDay,
} from "../../devotionals/time.js";
import { buildErrorEmbed } from "./ops.js";

export interface DevotionalCommandDeps {
  guildDevotionals: GuildDevotionalStore;
  devotionalScheduler: DevotionalSchedulerDeps;
}

export async function handleDevotionalAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "timezone") {
    await interaction.respond([]);
    return;
  }

  const choices = filterTimezones(String(focused.value)).slice(0, 25).map(
    (timezone) => ({
      name: timezone.replaceAll("_", " "),
      value: timezone,
    }),
  );

  await interaction.respond(choices);
}

export async function handleDevotionalCommand(
  interaction: ChatInputCommandInteraction,
  deps: DevotionalCommandDeps,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case "setup":
      await handleDevotionalSetup(interaction, deps);
      return;
    case "show":
      await handleDevotionalShow(interaction, deps);
      return;
    case "clear":
      await handleDevotionalClear(interaction, deps);
      return;
  }
}

async function handleDevotionalSetup(
  interaction: ChatInputCommandInteraction,
  deps: DevotionalCommandDeps,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [buildErrorEmbed("Devotional schedules can only be set in a server.")],
      ephemeral: true,
    });
    return;
  }

  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed("You need the Manage Server permission to configure devotionals."),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement
  ) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed("Choose a text channel for morning and evening devotionals."),
      ],
      ephemeral: true,
    });
    return;
  }

  const morningInput = interaction.options.getString("morning", true);
  const eveningInput = interaction.options.getString("evening", true);
  const timezone = interaction.options.getString("timezone", true);
  const morning = parseTimeOfDay(morningInput);
  const evening = parseTimeOfDay(eveningInput);

  if (!morning || !evening) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed(
          "Times must look like `6:30 am`, `6:30pm`, or `18:00`.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (!isValidTimezone(timezone)) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed(
          "That timezone is not valid. Try an IANA name like `America/Chicago`.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const guildChannel = interaction.guild?.channels.cache.get(channel.id);
  if (!guildChannel?.isTextBased()) {
    await interaction.reply({
      embeds: [buildErrorEmbed("Choose a text channel for morning and evening devotionals.")],
      ephemeral: true,
    });
    return;
  }

  const permissions = guildChannel.permissionsFor(interaction.client.user!.id);
  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed(
          `I can't send messages in ${channel.toString()}. Choose another channel or fix permissions.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await deps.guildDevotionals.set(interaction.guildId, {
    channelId: channel.id,
    timezone,
    morning,
    evening,
    setBy: interaction.user.id,
  });

  await interaction.reply({
    embeds: [
      createTyndaleEmbed(
        [
          "**Tyndale** · devotionals",
          `Morning and evening Spurgeon readings will post in ${channel.toString()}.`,
          "",
          `**Morning:** ${formatTimeOfDay(morning)}`,
          `**Evening:** ${formatTimeOfDay(evening)}`,
          `**Timezone:** ${timezone.replaceAll("_", " ")}`,
        ].join("\n"),
      ),
    ],
  });

  void runDevotionalCatchUpForGuild(
    interaction.client,
    deps.devotionalScheduler,
    interaction.guildId,
  );
}

async function handleDevotionalShow(
  interaction: ChatInputCommandInteraction,
  deps: DevotionalCommandDeps,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [buildErrorEmbed("Devotional schedules are only available in a server.")],
      ephemeral: true,
    });
    return;
  }

  const schedule = deps.guildDevotionals.get(interaction.guildId);
  if (!schedule) {
    await interaction.reply({
      embeds: [
        createTyndaleEmbed(
          [
            "**Tyndale** · devotionals",
            "This server has no devotional schedule yet.",
            "Use `/devotional setup` to choose a channel, morning time, evening time, and timezone.",
          ].join("\n"),
        ),
      ],
    });
    return;
  }

  const channelLabel = `<#${schedule.channelId}>`;

  await interaction.reply({
    embeds: [
      createTyndaleEmbed(
        [
          "**Tyndale** · devotionals",
          `Readings post in ${channelLabel}.`,
          "",
          `**Morning:** ${formatTimeOfDay(schedule.morning)}`,
          `**Evening:** ${formatTimeOfDay(schedule.evening)}`,
          `**Timezone:** ${schedule.timezone.replaceAll("_", " ")}`,
        ].join("\n"),
      ),
    ],
  });
}

async function handleDevotionalClear(
  interaction: ChatInputCommandInteraction,
  deps: DevotionalCommandDeps,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [buildErrorEmbed("Devotional schedules can only be cleared in a server.")],
      ephemeral: true,
    });
    return;
  }

  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed("You need the Manage Server permission to clear devotionals."),
      ],
      ephemeral: true,
    });
    return;
  }

  await deps.guildDevotionals.clear(interaction.guildId);

  await interaction.reply({
    embeds: [
      createTyndaleEmbed(
        [
          "**Tyndale** · devotionals",
          "Morning and evening devotional posting has been disabled for this server.",
        ].join("\n"),
      ),
    ],
  });
}
