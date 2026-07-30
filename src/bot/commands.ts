import { ChannelType, SlashCommandBuilder } from "discord.js";

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

export const devotionalCommand = new SlashCommandBuilder()
  .setName("devotional")
  .setDescription("Morning and evening Spurgeon devotionals")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("setup")
      .setDescription(
        "Set channel, morning time, evening time, and timezone together",
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for morning and evening readings")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("morning")
          .setDescription("Morning post time (e.g. 6:30 am)")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("evening")
          .setDescription("Evening post time (e.g. 6:00 pm)")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("timezone")
          .setDescription("IANA timezone (e.g. America/Chicago)")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("show")
      .setDescription("Show this server's devotional schedule"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("clear")
      .setDescription("Disable morning and evening devotionals for this server"),
  );

export const SLASH_COMMANDS = [
  helpCommand,
  versionCommand,
  serverCommand,
  devotionalCommand,
];
