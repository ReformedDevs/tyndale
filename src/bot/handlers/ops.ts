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
    `*Translations:* ${translations} (bot default: ${defaultTranslation.toUpperCase()})`,
    "",
    "**Bot commands**",
    "• `[Tyndale help]` — this message",
    "• `[Tyndale status]` — uptime and health",
    "• `[Tyndale server status]` — server defaults",
    "• `[Tyndale translation]` — your default translation",
    "• `[Tyndale translation asv]` — set your default",
    "• `[Tyndale translation reset]` — use server or bot default",
    "• `[Tyndale server translation]` — this server's default",
    "• `[Tyndale server translation asv]` — set server default",
    "• `[Tyndale server translation reset]` — clear server default",
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

export function buildTranslationShowEmbed(
  userTranslation: Translation | undefined,
  guildTranslation: Translation | undefined,
  botDefault: Translation,
): EmbedBuilder {
  if (userTranslation) {
    return createTyndaleEmbed(
      [
        "**Tyndale** · translation",
        `Your default translation is **${userTranslation.toUpperCase()}**.`,
        "I'll use it for your citations unless you specify another one.",
      ].join("\n"),
    );
  }

  if (guildTranslation) {
    return createTyndaleEmbed(
      [
        "**Tyndale** · translation",
        `You're using this server's default: **${guildTranslation.toUpperCase()}**.`,
        "Set a personal override with `[Tyndale translation asv]`.",
      ].join("\n"),
    );
  }

  return createTyndaleEmbed(
    [
      "**Tyndale** · translation",
      `You're using the bot default: **${botDefault.toUpperCase()}**.`,
      "Set yours with `[Tyndale translation asv]`.",
    ].join("\n"),
  );
}

export function buildTranslationSetEmbed(translation: Translation): EmbedBuilder {
  return createTyndaleEmbed(
    [
      "**Tyndale** · translation",
      `Got it — **${translation.toUpperCase()}** is now your default translation.`,
      "I'll use it for your citations unless you specify another one.",
    ].join("\n"),
  );
}

export function buildTranslationResetEmbed(
  guildTranslation: Translation | undefined,
  botDefault: Translation,
): EmbedBuilder {
  const fallback = guildTranslation ?? botDefault;
  const source = guildTranslation ? "this server's default" : "the bot default";

  return createTyndaleEmbed(
    [
      "**Tyndale** · translation",
      `Cleared your translation preference. Using ${source}: **${fallback.toUpperCase()}**.`,
    ].join("\n"),
  );
}

export function buildServerTranslationShowEmbed(
  guildTranslation: Translation | undefined,
  botDefault: Translation,
): EmbedBuilder {
  if (guildTranslation) {
    return createTyndaleEmbed(
      [
        "**Tyndale** · server translation",
        `This server's default translation is **${guildTranslation.toUpperCase()}**.`,
        `Bot default: ${botDefault.toUpperCase()}.`,
      ].join("\n"),
    );
  }

  return createTyndaleEmbed(
    [
      "**Tyndale** · server translation",
      `This server uses the bot default: **${botDefault.toUpperCase()}**.`,
      "Set one with `[Tyndale server translation asv]`.",
    ].join("\n"),
  );
}

export function buildServerTranslationSetEmbed(
  translation: Translation,
): EmbedBuilder {
  return createTyndaleEmbed(
    [
      "**Tyndale** · server translation",
      `This server's default translation is now **${translation.toUpperCase()}**.`,
      "Members can still override it with their own `[Tyndale translation ...]` setting.",
    ].join("\n"),
  );
}

export function buildServerTranslationResetEmbed(
  botDefault: Translation,
): EmbedBuilder {
  return createTyndaleEmbed(
    [
      "**Tyndale** · server translation",
      `Cleared this server's translation preference. Using bot default: **${botDefault.toUpperCase()}**.`,
    ].join("\n"),
  );
}

export function buildServerStatusEmbed(details: ServerStatusDetails): EmbedBuilder {
  const translations = TRANSLATIONS.map((translation) =>
    translation.toUpperCase(),
  ).join(", ");
  const effectiveDefault = details.guildTranslation ?? details.botDefault;
  const lines = [
    "**Tyndale** · server status",
    details.guildTranslation
      ? `*Server default translation:* ${details.guildTranslation.toUpperCase()}`
      : `*Server default translation:* ${details.botDefault.toUpperCase()} (bot default)`,
  ];

  if (details.guildTranslation && details.guildDefaultSetAt) {
    const setAtLabel = formatStatusTimestamp(details.guildDefaultSetAt);
    const setByLabel = details.guildDefaultSetBy ?? "unknown";
    lines.push(`*Set:* ${setAtLabel} by ${setByLabel}`);
  }

  lines.push(
    `*Bot default:* ${details.botDefault.toUpperCase()}`,
    `*Available translations:* ${translations}`,
    `*Personal overrides in this server:* ${details.memberOverrideCount}`,
    "",
    `Members without a personal setting use **${effectiveDefault.toUpperCase()}**.`,
    "",
    `*Citations this week:* ${details.citationsThisWeek}`,
    `*Citations total:* ${details.citationsTotal}`,
    `*Most cited:* ${formatTopBooks(details.topBooks)}`,
  );

  return createTyndaleEmbed(lines.join("\n"));
}

export interface ServerStatusDetails {
  guildTranslation?: Translation;
  guildDefaultSetAt?: string;
  guildDefaultSetBy?: string;
  botDefault: Translation;
  memberOverrideCount: number;
  citationsTotal: number;
  citationsThisWeek: number;
  topBooks: Array<{ bookName: string; count: number }>;
}

function formatStatusTimestamp(isoTimestamp: string): string {
  const timestamp = Date.parse(isoTimestamp);
  if (Number.isNaN(timestamp)) {
    return "unknown time";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTopBooks(
  topBooks: Array<{ bookName: string; count: number }>,
): string {
  if (topBooks.length === 0) {
    return "none yet";
  }

  return topBooks
    .map((entry) => `${entry.bookName} (${entry.count})`)
    .join(", ");
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
