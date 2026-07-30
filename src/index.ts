import "dotenv/config";

import { createBotClient } from "./bot/client.js";
import { buildSlashCommands } from "./bot/commands.js";
import { registerSlashCommands } from "./bot/register-commands.js";
import { registerInteractionHandler } from "./bot/handlers/interaction.js";
import { registerMessageHandler } from "./bot/handlers/message.js";
import { VerseLookup } from "./citations/bible/lookup.js";
import { ConfessionLookup } from "./citations/confessions/lookup.js";
import { PoetryLayoutLookup } from "./citations/bible/poetry-layout.js";
import { loadConfig, validateDefaultTranslation } from "./config.js";
import { GuildAnalyticsStore } from "./preferences/guild-analytics.js";
import { GuildDevotionalStore } from "./preferences/guild-devotionals.js";
import { GuildFormatStore } from "./preferences/guild-formats.js";
import { GuildTranslationStore } from "./preferences/guild-translations.js";
import { UserFormatStore } from "./preferences/user-formats.js";
import { UserTranslationStore } from "./preferences/user-translations.js";
import { SpurgeonDevotionalLookup } from "./devotionals/spurgeon-lookup.js";
import { startDevotionalScheduler } from "./devotionals/scheduler.js";
import { ChurchPeopleLookup } from "./people/lookup.js";
import {
  contentPaths,
  resolveContentDir,
  resolveStateDir,
  stateFile,
} from "./paths.js";
import { migrateLegacyStateFiles } from "./state/migrate.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const contentDir = resolveContentDir();
  const stateDir = resolveStateDir();
  const paths = contentPaths(contentDir);

  await migrateLegacyStateFiles(stateDir);

  const lookup = await VerseLookup.load(paths.bibles);
  validateDefaultTranslation(config, lookup.availableTranslations());

  const confessionLookup = await ConfessionLookup.load(paths.confessions);
  const poetryLayout = await PoetryLayoutLookup.load(paths.poetry);
  const userTranslations = await UserTranslationStore.load(
    stateFile(stateDir, "user-translations.json"),
  );
  const guildTranslations = await GuildTranslationStore.load(
    stateFile(stateDir, "guild-translations.json"),
  );
  const userFormats = await UserFormatStore.load(
    stateFile(stateDir, "user-formats.json"),
  );
  const guildFormats = await GuildFormatStore.load(
    stateFile(stateDir, "guild-formats.json"),
  );
  const guildAnalytics = await GuildAnalyticsStore.load(
    stateFile(stateDir, "guild-analytics.json"),
  );
  const guildDevotionals = await GuildDevotionalStore.load(
    stateFile(stateDir, "guild-devotionals.json"),
  );
  const spurgeonDevotionals = await SpurgeonDevotionalLookup.load(
    paths.devotionals,
  );
  const churchPeople = await ChurchPeopleLookup.load(paths.people);
  const devotionalScheduler = {
    store: guildDevotionals,
    spurgeon: spurgeonDevotionals,
    lookup,
    poetryLayout,
    config,
    guildTranslations,
    guildFormats,
  };
  const startedAt = Date.now();

  const client = createBotClient(config);
  const preferenceDeps = {
    config,
    userTranslations,
    guildTranslations,
    userFormats,
    guildFormats,
    guildDevotionals,
    devotionalScheduler,
    churchPeople,
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

  startDevotionalScheduler(client, devotionalScheduler);

  await client.login(config.DISCORD_BOT_TOKEN);
  await registerSlashCommands(
    client,
    config,
    buildSlashCommands(lookup.availableTranslations()),
  );
}

main().catch((error: unknown) => {
  console.error("Failed to start Tyndale:", error);
  process.exit(1);
});
