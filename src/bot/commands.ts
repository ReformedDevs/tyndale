import { SlashCommandBuilder } from "discord.js";

import { TRANSLATIONS } from "../citations/bible/lookup.js";

const translationChoices = TRANSLATIONS.map((translation) => ({
  name: translation.toUpperCase(),
  value: translation,
}));

export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show citation syntax and Tyndale commands");

export const versionCommand = new SlashCommandBuilder()
  .setName("version")
  .setDescription("Manage your default Bible translation")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("show")
      .setDescription("Display your default Bible version preferences"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set")
      .setDescription("Set your default Bible version")
      .addStringOption((option) =>
        option
          .setName("translation")
          .setDescription("Translation to use for your citations")
          .setRequired(true)
          .addChoices(...translationChoices),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("clear").setDescription("Clear your default Bible version"),
  );

export const serverCommand = new SlashCommandBuilder()
  .setName("server")
  .setDescription("Manage server-wide Tyndale settings")
  .addSubcommandGroup((group) =>
    group
      .setName("version")
      .setDescription("Manage this server's default translation")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("show")
          .setDescription("Display the default version for this server"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set the default Bible version for this server")
          .addStringOption((option) =>
            option
              .setName("translation")
              .setDescription("Translation to use for server citations")
              .setRequired(true)
              .addChoices(...translationChoices),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("clear")
          .setDescription("Clear the default version for this server"),
      ),
  );

export const SLASH_COMMANDS = [helpCommand, versionCommand, serverCommand];
