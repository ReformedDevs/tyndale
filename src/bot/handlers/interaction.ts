import {
  Events,
  type ChatInputCommandInteraction,
  type Client,
  type Interaction,
} from "discord.js";

import type { Config } from "../../config.js";
import type { GuildFormatStore } from "../../preferences/guild-formats.js";
import type { GuildTranslationStore } from "../../preferences/guild-translations.js";
import type { UserFormatStore } from "../../preferences/user-formats.js";
import type { UserTranslationStore } from "../../preferences/user-translations.js";
import {
  resolveDefaultTextFormat,
  resolveDefaultTranslation,
} from "../resolve-defaults.js";
import {
  handleServerVersionCommand,
  handleVersionCommand,
} from "./version-commands.js";
import { buildHelpEmbed } from "./ops.js";

export interface InteractionHandlerDeps {
  config: Config;
  userTranslations: UserTranslationStore;
  guildTranslations: GuildTranslationStore;
  userFormats: UserFormatStore;
  guildFormats: GuildFormatStore;
}

export function registerInteractionHandler(
  client: Client,
  deps: InteractionHandlerDeps,
): void {
  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, deps);
  });
}

async function handleInteraction(
  interaction: Interaction,
  deps: InteractionHandlerDeps,
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    switch (interaction.commandName) {
      case "help":
        await handleHelpCommand(interaction, deps);
        break;
      case "version":
        await handleVersionCommand(interaction, deps);
        break;
      case "server":
        if (interaction.options.getSubcommandGroup() === "version") {
          await handleServerVersionCommand(interaction, deps);
        }
        break;
    }
  } catch (error) {
    console.error("Failed to handle slash command:", error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Something went wrong handling that command.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: "Something went wrong handling that command.",
      ephemeral: true,
    });
  }
}

async function handleHelpCommand(
  interaction: ChatInputCommandInteraction,
  deps: InteractionHandlerDeps,
): Promise<void> {
  const context = {
    userId: interaction.user.id,
    guildId: interaction.guildId,
  };
  const translation = resolveDefaultTranslation(context, deps);
  const textFormat = resolveDefaultTextFormat(context, deps);

  await interaction.reply({
    embeds: [buildHelpEmbed(translation, textFormat)],
  });
}
