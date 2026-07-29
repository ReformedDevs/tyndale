import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";

import { createBotClient } from "./bot/client.js";
import { registerMessageHandler } from "./bot/handlers/message.js";
import { VerseLookup } from "./citations/bible/lookup.js";
import { loadConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

async function main(): Promise<void> {
  const config = loadConfig();
  const lookup = await VerseLookup.load(dataDir);
  const startedAt = Date.now();

  const client = createBotClient(config);
  registerMessageHandler(client, { config, lookup, startedAt });

  await client.login(config.DISCORD_BOT_TOKEN);
}

main().catch((error: unknown) => {
  console.error("Failed to start Tyndale:", error);
  process.exit(1);
});
