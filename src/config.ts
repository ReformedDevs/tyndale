import { z } from "zod";

const configSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DEFAULT_TRANSLATION: z.enum(["web", "asv", "ylt"]).default("web"),
  REPLY_FORMAT: z.enum(["text", "embed"]).default("text"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}
