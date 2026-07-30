import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";

import { createBotClient } from "./bot/client.js";
import { registerMessageHandler } from "./bot/handlers/message.js";
import { VerseLookup } from "./citations/bible/lookup.js";
import { loadConfig } from "./config.js";
import { GuildAnalyticsStore } from "./preferences/guild-analytics.js";
import { GuildTranslationStore } from "./preferences/guild-translations.js";
import { UserTranslationStore } from "./preferences/user-translations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const userTranslationsPath = path.join(dataDir, "user-translations.json");
const guildTranslationsPath = path.join(dataDir, "guild-translations.json");
const guildAnalyticsPath = path.join(dataDir, "guild-analytics.json");

async function main(): Promise<void> {
  const config = loadConfig();
  const lookup = await VerseLookup.load(dataDir);
  const userTranslations = await UserTranslationStore.load(userTranslationsPath);
  const guildTranslations = await GuildTranslationStore.load(
    guildTranslationsPath,
  );
  const guildAnalytics = await GuildAnalyticsStore.load(guildAnalyticsPath);
  const startedAt = Date.now();

  const client = createBotClient(config);
  registerMessageHandler(client, {
    config,
    lookup,
    userTranslations,
    guildTranslations,
    guildAnalytics,
    startedAt,
  });

  await client.login(config.DISCORD_BOT_TOKEN);
}

main().catch((error: unknown) => {
  console.error("Failed to start Tyndale:", error);
  process.exit(1);
});
