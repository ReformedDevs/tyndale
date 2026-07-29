import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import type { Config } from "../config.js";

export function createBotClient(config: Config): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, () => {
    client.user?.setPresence({
      activities: [{ name: "for citations", type: ActivityType.Watching }],
      status: "online",
    });

    console.info(
      `Logged in as ${client.user?.tag} (default translation: ${config.DEFAULT_TRANSLATION}, reply format: ${config.REPLY_FORMAT})`,
    );
  });

  client.on("error", (error) => {
    console.error("Discord client error:", error);
  });

  return client;
}
