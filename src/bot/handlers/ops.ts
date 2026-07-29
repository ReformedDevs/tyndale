import type { Client, EmbedBuilder } from "discord.js";

import { createTyndaleEmbed } from "../../citations/bible/format.js";
import {
  TRANSLATIONS,
  type Translation,
} from "../../citations/bible/lookup.js";

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatHelpReply(defaultTranslation: Translation): string {
  const translations = TRANSLATIONS.map((translation) =>
    translation.toUpperCase(),
  ).join(", ");

  return [
    "**Tyndale** · help",
    "Post a bracket citation in any message and Tyndale will reply with the verse text. Book names, abbreviations, and translation codes are case-insensitive.",
    "",
    "**Examples**",
    "• `[Gen 1:1]` — single verse",
    "• `[Gen 1:1-3]` — verse range",
    "• `[Gen 1:1,3,5]` — multiple verses",
    "• `[Genesis 1:1]` — full book name",
    "• `[ASV Gen 1:1]` — translation prefix",
    "• `[Ps 150]` — whole chapter",
    "• `[Ps 150:5-end]` — verses through chapter end",
    "",
    `*Translations:* ${translations} (default: ${defaultTranslation.toUpperCase()})`,
    "",
    "**Bot commands**",
    "• `[Tyndale help]` — this message",
    "• `[Tyndale status]` — uptime and health",
    "",
    "Brackets inside `>` quote lines are ignored. Non-citation brackets like `[hello]` are skipped.",
  ].join("\n");
}

export function buildHelpEmbed(
  defaultTranslation: Translation,
): EmbedBuilder {
  return createTyndaleEmbed(formatHelpReply(defaultTranslation));
}

export function buildStatusEmbed(
  client: Client,
  startedAt: number,
): EmbedBuilder {
  return createTyndaleEmbed(formatStatusReply(client, startedAt));
}

export function buildErrorEmbed(message: string): EmbedBuilder {
  return createTyndaleEmbed(`_${message}_`);
}

export function formatStatusReply(client: Client, startedAt: number): string {
  const uptime = formatUptime(Date.now() - startedAt);
  const translations = TRANSLATIONS.map((translation) =>
    translation.toUpperCase(),
  ).join(", ");

  return [
    "**Tyndale** · online",
    `*Uptime:* ${uptime}  ·  *Gateway:* ${client.ws.ping}ms`,
    `*Translations:* ${translations}`,
  ].join("\n");
}
