import { z } from "zod";

import { TEXT_FORMATS } from "./citations/bible/text-format.js";

const configSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DEFAULT_TRANSLATION: z.enum(["web", "asv", "ylt"]).default("web"),
  DEFAULT_TEXT_FORMAT: z.enum(TEXT_FORMATS).default("literary"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}
