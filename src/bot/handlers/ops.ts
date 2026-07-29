import type { Client } from "discord.js";

import { TRANSLATIONS } from "../../citations/bible/lookup.js";

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

export function formatStatusReply(client: Client, startedAt: number): string {
  const uptime = formatUptime(Date.now() - startedAt);
  const translations = TRANSLATIONS.map((translation) =>
    translation.toUpperCase(),
  ).join(", ");

  return [
    "**Tyndale** — online",
    `Uptime: ${uptime} | Gateway: ${client.ws.ping}ms`,
    `Translations: ${translations}`,
  ].join("\n");
}
