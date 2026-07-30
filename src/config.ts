import { z } from "zod";

import { TEXT_FORMATS } from "./citations/bible/text-format.js";

const configSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DEFAULT_TRANSLATION: z.string().default("web"),
  DEFAULT_TEXT_FORMAT: z.enum(TEXT_FORMATS).default("literary"),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}

export function validateDefaultTranslation(
  config: Config,
  availableTranslations: readonly string[],
): void {
  const normalized = config.DEFAULT_TRANSLATION.toLowerCase();
  if (!availableTranslations.includes(normalized)) {
    throw new Error(
      `DEFAULT_TRANSLATION "${config.DEFAULT_TRANSLATION}" is not available. Loaded: ${availableTranslations.join(", ")}`,
    );
  }
}
