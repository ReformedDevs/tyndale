import type { ChatInputCommandInteraction } from "discord.js";

import type { Translation } from "../../citations/bible/lookup.js";
import type { Config } from "../../config.js";
import type { GuildTranslationStore } from "../../preferences/guild-translations.js";
import type { UserTranslationStore } from "../../preferences/user-translations.js";
import {
  buildErrorEmbed,
  buildServerTranslationResetEmbed,
  buildServerTranslationSetEmbed,
  buildServerTranslationShowEmbed,
  buildTranslationResetEmbed,
  buildTranslationSetEmbed,
  buildTranslationShowEmbed,
} from "./ops.js";

export interface VersionCommandDeps {
  config: Config;
  userTranslations: UserTranslationStore;
  guildTranslations: GuildTranslationStore;
}

export async function handleVersionCommand(
  interaction: ChatInputCommandInteraction,
  deps: VersionCommandDeps,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const guildTranslation = guildId
    ? deps.guildTranslations.get(guildId)
    : undefined;
  const botDefault = deps.config.DEFAULT_TRANSLATION;

  switch (subcommand) {
    case "show":
      await interaction.reply({
        embeds: [
          buildTranslationShowEmbed(
            deps.userTranslations.get(userId),
            guildTranslation,
            botDefault,
          ),
        ],
      });
      return;
    case "set": {
      const translation = interaction.options.getString(
        "translation",
        true,
      ) as Translation;
      await deps.userTranslations.set(userId, translation, guildId ?? undefined);
      await interaction.reply({
        embeds: [buildTranslationSetEmbed(translation)],
      });
      return;
    }
    case "clear":
      await deps.userTranslations.clear(userId);
      await interaction.reply({
        embeds: [buildTranslationResetEmbed(guildTranslation, botDefault)],
      });
      return;
  }
}

export async function handleServerVersionCommand(
  interaction: ChatInputCommandInteraction,
  deps: VersionCommandDeps,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [
        buildErrorEmbed(
          "Server translation preferences can only be viewed or changed in a server.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId;
  const botDefault = deps.config.DEFAULT_TRANSLATION;
  const guildTranslation = deps.guildTranslations.get(guildId);

  switch (subcommand) {
    case "show":
      await interaction.reply({
        embeds: [buildServerTranslationShowEmbed(guildTranslation, botDefault)],
      });
      return;
    case "set": {
      const translation = interaction.options.getString(
        "translation",
        true,
      ) as Translation;
      await deps.guildTranslations.set(
        guildId,
        translation,
        interaction.user.id,
      );
      await interaction.reply({
        embeds: [buildServerTranslationSetEmbed(translation)],
      });
      return;
    }
    case "clear":
      await deps.guildTranslations.clear(guildId);
      await interaction.reply({
        embeds: [buildServerTranslationResetEmbed(botDefault)],
      });
      return;
  }
}
