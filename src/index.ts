import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";

import { createBotClient } from "./bot/client.js";
import { registerSlashCommands } from "./bot/register-commands.js";
import { registerInteractionHandler } from "./bot/handlers/interaction.js";
import { registerMessageHandler } from "./bot/handlers/message.js";
import { VerseLookup } from "./citations/bible/lookup.js";
import { ConfessionLookup } from "./citations/confessions/lookup.js";
import { PoetryLayoutLookup } from "./citations/bible/poetry-layout.js";
import { loadConfig } from "./config.js";
import { GuildAnalyticsStore } from "./preferences/guild-analytics.js";
import { GuildFormatStore } from "./preferences/guild-formats.js";
import { GuildTranslationStore } from "./preferences/guild-translations.js";
import { UserFormatStore } from "./preferences/user-formats.js";
import { UserTranslationStore } from "./preferences/user-translations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const userTranslationsPath = path.join(dataDir, "user-translations.json");
const guildTranslationsPath = path.join(dataDir, "guild-translations.json");
const userFormatsPath = path.join(dataDir, "user-formats.json");
const guildFormatsPath = path.join(dataDir, "guild-formats.json");
const guildAnalyticsPath = path.join(dataDir, "guild-analytics.json");

async function main(): Promise<void> {
  const config = loadConfig();
  const lookup = await VerseLookup.load(dataDir);
  const confessionLookup = await ConfessionLookup.load(dataDir);
  const poetryLayout = await PoetryLayoutLookup.load(dataDir);
  const userTranslations = await UserTranslationStore.load(userTranslationsPath);
  const guildTranslations = await GuildTranslationStore.load(
    guildTranslationsPath,
  );
  const userFormats = await UserFormatStore.load(userFormatsPath);
  const guildFormats = await GuildFormatStore.load(guildFormatsPath);
  const guildAnalytics = await GuildAnalyticsStore.load(guildAnalyticsPath);
  const startedAt = Date.now();

  const client = createBotClient(config);
  const preferenceDeps = {
    config,
    userTranslations,
    guildTranslations,
    userFormats,
    guildFormats,
  };

  registerMessageHandler(client, {
    ...preferenceDeps,
    lookup,
    confessionLookup,
    poetryLayout,
    guildAnalytics,
    startedAt,
  });
  registerInteractionHandler(client, preferenceDeps);

  await client.login(config.DISCORD_BOT_TOKEN);
  await registerSlashCommands(client, config);
}

main().catch((error: unknown) => {
  console.error("Failed to start Tyndale:", error);
  process.exit(1);
});
