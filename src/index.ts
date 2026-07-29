import "dotenv/config";

import { createBotClient } from "./bot/client.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const client = createBotClient(config);
  await client.login(config.DISCORD_BOT_TOKEN);
}

main().catch((error: unknown) => {
  console.error("Failed to start Tyndale:", error);
  process.exit(1);
});
