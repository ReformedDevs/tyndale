import {
  PermissionFlagsBits,
  ThreadAutoArchiveDuration,
  type Client,
  type EmbedBuilder,
  type GuildTextBasedChannel,
  type Message,
  type SendableChannels,
} from "discord.js";

import { buildBibleCitationEmbeds } from "../citations/bible/format.js";
import type { VerseLookup } from "../citations/bible/lookup.js";
import { parseScriptureReference } from "../citations/bible/parser.js";
import type { PoetryLayoutLookup } from "../citations/bible/poetry-layout.js";
import type { TextFormat } from "../citations/bible/text-format.js";
import type { Config } from "../config.js";
import type { GuildFormatStore } from "../preferences/guild-formats.js";
import type { GuildTranslationStore } from "../preferences/guild-translations.js";
import {
  buildSpurgeonDevotionalEmbeds,
  getDevotionalThreadName,
} from "./format.js";
import type { SpurgeonDevotionalEntry } from "./spurgeon-lookup.js";

export interface DevotionalPostDeps {
  lookup: VerseLookup;
  poetryLayout: PoetryLayoutLookup;
  config: Config;
  guildTranslations: GuildTranslationStore;
  guildFormats: GuildFormatStore;
}

async function sendEmbedsSequentially(
  target: SendableChannels,
  embeds: EmbedBuilder[],
): Promise<void> {
  for (const embed of embeds) {
    await target.send({ embeds: [embed] });
  }
}

function buildVerseEmbeds(
  guildId: string,
  reference: string,
  deps: DevotionalPostDeps,
): { embeds: EmbedBuilder[]; threadName: string } | undefined {
  const citation = parseScriptureReference(reference);
  if (!citation) {
    return undefined;
  }

  const translation =
    deps.guildTranslations.get(guildId) ?? deps.config.DEFAULT_TRANSLATION;
  const textFormat: TextFormat =
    deps.guildFormats.get(guildId) ?? deps.config.DEFAULT_TEXT_FORMAT;
  const result = buildBibleCitationEmbeds(
    citation,
    deps.lookup,
    translation,
    textFormat,
    deps.poetryLayout,
  );

  if ("error" in result || result.embeds.length === 0) {
    return undefined;
  }

  return result;
}

function canCreateThread(
  client: Client,
  channel: GuildTextBasedChannel,
): boolean {
  const permissions = channel.permissionsFor(client.user!.id);
  return (
    permissions?.has(PermissionFlagsBits.CreatePublicThreads) === true &&
    permissions?.has(PermissionFlagsBits.SendMessagesInThreads) === true
  );
}

export async function postSpurgeonDevotional(
  client: Client,
  channel: GuildTextBasedChannel,
  guildId: string,
  entry: SpurgeonDevotionalEntry,
  deps: DevotionalPostDeps,
): Promise<Message | undefined> {
  const permissions = channel.permissionsFor(client.user!.id);
  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    console.warn(
      `Missing SendMessages in devotional channel ${channel.id} for guild ${guildId}`,
    );
    return undefined;
  }

  const devotionalEmbeds = buildSpurgeonDevotionalEmbeds(entry);
  const verseResult = entry.reference.trim()
    ? buildVerseEmbeds(guildId, entry.reference, deps)
    : undefined;
  const verseEmbeds = verseResult?.embeds ?? [];
  const needsThread = devotionalEmbeds.length > 1 || verseEmbeds.length > 0;

  const [firstDevotional, ...remainingDevotional] = devotionalEmbeds;
  const message = await channel.send({ embeds: [firstDevotional!] });

  if (!needsThread) {
    return message;
  }

  if (!message.guild || !canCreateThread(client, channel)) {
    console.warn(
      `Missing thread permissions for devotional follow-up in guild ${guildId}`,
    );
    return message;
  }

  const threadName = getDevotionalThreadName(entry);

  try {
    const thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
    });
    await sendEmbedsSequentially(thread, remainingDevotional);
    await sendEmbedsSequentially(thread, verseEmbeds);
  } catch (error) {
    console.error(
      `Failed to thread devotional follow-up for guild ${guildId}:`,
      error,
    );
  }

  return message;
}
