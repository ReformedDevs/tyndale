import { REST, Routes, type Client } from "discord.js";

import type { Config } from "../config.js";
import { SLASH_COMMANDS } from "./commands.js";

export async function registerSlashCommands(
  client: Client,
  config: Config,
): Promise<void> {
  const applicationId = client.application?.id;
  if (!applicationId) {
    throw new Error("Client application id unavailable");
  }

  const rest = new REST({ version: "10" }).setToken(config.DISCORD_BOT_TOKEN);
  const body = SLASH_COMMANDS.map((command) => command.toJSON());

  if (config.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(applicationId, config.DISCORD_GUILD_ID),
      { body },
    );
    console.info(
      `Registered ${body.length} guild slash command(s) in ${config.DISCORD_GUILD_ID}`,
    );
    return;
  }

  await rest.put(Routes.applicationCommands(applicationId), { body });
  console.info(`Registered ${body.length} global slash command(s)`);
}
