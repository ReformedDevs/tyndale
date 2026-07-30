import {
  AttachmentBuilder,
  EmbedBuilder,
  Events,
  ThreadAutoArchiveDuration,
  type Client,
  type Message,
  type SendableChannels,
} from "discord.js";

import { buildBibleCitationEmbedsForMany } from "../../citations/bible/format.js";
import { findBracketCitations } from "../../citations/bible/parser.js";
import { buildConfessionCitationEmbeds } from "../../citations/confessions/format.js";
import { buildConfessionDiffEmbeds, confessionDiffAttachments } from "../../citations/confessions/diff-format.js";
import type { ConfessionLookup } from "../../citations/confessions/lookup.js";
import type { VerseLookup, Translation } from "../../citations/bible/lookup.js";
import type { PoetryLayoutLookup } from "../../citations/bible/poetry-layout.js";
import type { TextFormat } from "../../citations/bible/text-format.js";
import type {
  ParsedBibleCitation,
  ParsedConfessionCitation,
  ParsedConfessionDiffCitation,
  ParsedFormatCitation,
  ParsedServerFormatCitation,
} from "../../citations/types.js";
import type { Config } from "../../config.js";
import {
  resolveDefaultTextFormat,
  resolveDefaultTranslation,
} from "../resolve-defaults.js";
import type { GuildAnalyticsStore } from "../../preferences/guild-analytics.js";
import type { GuildFormatStore } from "../../preferences/guild-formats.js";
import type { GuildTranslationStore } from "../../preferences/guild-translations.js";
import type { UserFormatStore } from "../../preferences/user-formats.js";
import type { UserTranslationStore } from "../../preferences/user-translations.js";
import {
  buildErrorEmbed,
  buildFormatResetEmbed,
  buildFormatSetEmbed,
  buildFormatShowEmbed,
  buildHelpEmbed,
  buildServerFormatResetEmbed,
  buildServerFormatSetEmbed,
  buildServerFormatShowEmbed,
  buildServerStatusEmbed,
  buildStatusEmbed,
} from "./ops.js";

export interface MessageHandlerDeps {
  config: Config;
  lookup: VerseLookup;
  confessionLookup: ConfessionLookup;
  poetryLayout: PoetryLayoutLookup;
  userTranslations: UserTranslationStore;
  guildTranslations: GuildTranslationStore;
  userFormats: UserFormatStore;
  guildFormats: GuildFormatStore;
  guildAnalytics: GuildAnalyticsStore;
  startedAt: number;
}

type CitationUnit = {
  embeds: EmbedBuilder[];
  threadName?: string;
  files?: AttachmentBuilder[];
};

/** Reply with connector UI but without @mentioning / highlighting the author. */
async function replyWithoutPing(
  message: Message,
  options: { embeds: EmbedBuilder[]; files?: AttachmentBuilder[] },
): Promise<Message> {
  return message.reply({
    ...options,
    allowedMentions: { repliedUser: false },
  });
}

async function sendEmbedsSequentially(
  target: SendableChannels,
  embeds: EmbedBuilder[],
): Promise<void> {
  // Discord allows 6000 total embed characters per message — send one embed each.
  for (const embed of embeds) {
    await target.send({ embeds: [embed] });
  }
}

async function startCitationThread(
  message: Message,
  threadName: string,
): Promise<SendableChannels> {
  if (!message.guild) {
    return message.channel as SendableChannels;
  }

  return message.startThread({
    name: threadName.slice(0, 100),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
  });
}

async function sendCitationUnit(
  message: Message,
  unit: CitationUnit,
): Promise<void> {
  if (unit.embeds.length === 0) {
    return;
  }

  const files = unit.files ?? [];

  if (unit.embeds.length === 1) {
    await replyWithoutPing(message, { embeds: [unit.embeds[0]!], files });
    return;
  }

  const inExistingThread = message.channel.isThread();

  if (inExistingThread || !message.guild) {
    const [firstEmbed, ...remainingEmbeds] = unit.embeds;
    const [firstFile, ...remainingFiles] = files;
    await replyWithoutPing(message, {
      embeds: [firstEmbed!],
      files: firstFile ? [firstFile] : [],
    });

    for (let index = 0; index < remainingEmbeds.length; index += 1) {
      const embed = remainingEmbeds[index]!;
      const file = remainingFiles[index];
      await (message.channel as SendableChannels).send({
        embeds: [embed],
        ...(file ? { files: [file] } : {}),
      });
    }

    return;
  }

  const thread = await startCitationThread(
    message,
    unit.threadName ?? "Citation continued",
  );

  for (let index = 0; index < unit.embeds.length; index += 1) {
    const embed = unit.embeds[index]!;
    const file = files[index];
    await thread.send({
      embeds: [embed],
      ...(file ? { files: [file] } : {}),
    });
  }
}

function getGuildFormat(
  message: Message,
  deps: MessageHandlerDeps,
): TextFormat | undefined {
  if (!message.guild) {
    return undefined;
  }

  return deps.guildFormats.get(message.guild.id);
}

async function resolveMemberLabel(
  message: Message,
  userId: string,
): Promise<string> {
  if (!message.guild || !userId) {
    return userId || "unknown";
  }

  const member = await message.guild.members.fetch(userId).catch(() => null);
  return member?.displayName ?? userId;
}

async function buildServerStatusEmbedForMessage(
  message: Message,
  deps: MessageHandlerDeps,
): Promise<EmbedBuilder> {
  const guildId = message.guild!.id;
  const guildPreference = deps.guildTranslations.getPreference(guildId);
  const guildFormatPreference = deps.guildFormats.getPreference(guildId);
  const analytics = deps.guildAnalytics.getSummary(guildId);

  return buildServerStatusEmbed({
    guildTranslation: guildPreference?.translation,
    guildDefaultSetAt: guildPreference?.setAt || undefined,
    guildDefaultSetBy: guildPreference?.setBy
      ? await resolveMemberLabel(message, guildPreference.setBy)
      : undefined,
    guildFormat: guildFormatPreference?.format,
    guildFormatSetAt: guildFormatPreference?.setAt || undefined,
    guildFormatSetBy: guildFormatPreference?.setBy
      ? await resolveMemberLabel(message, guildFormatPreference.setBy)
      : undefined,
    botDefault: deps.config.DEFAULT_TRANSLATION,
    botDefaultFormat: deps.config.DEFAULT_TEXT_FORMAT,
    memberOverrideCount: deps.userTranslations.countForGuild(guildId),
    memberFormatOverrideCount: deps.userFormats.countForGuild(guildId),
    citationsTotal: analytics.citationsTotal,
    citationsThisWeek: analytics.citationsThisWeek,
    topBooks: analytics.topBooks,
  });
}

async function buildFormatPreferenceEmbed(
  message: Message,
  citation: ParsedFormatCitation,
  deps: MessageHandlerDeps,
): Promise<EmbedBuilder> {
  const userId = message.author.id;
  const botDefault = deps.config.DEFAULT_TEXT_FORMAT;
  const guildFormat = getGuildFormat(message, deps);

  switch (citation.action) {
    case "show":
      return buildFormatShowEmbed(
        deps.userFormats.get(userId),
        guildFormat,
        botDefault,
      );
    case "set":
      await deps.userFormats.set(userId, citation.format!, message.guild?.id);
      return buildFormatSetEmbed(citation.format!);
    case "reset":
      await deps.userFormats.clear(userId);
      return buildFormatResetEmbed(guildFormat, botDefault);
  }
}

async function buildServerFormatPreferenceEmbed(
  message: Message,
  citation: ParsedServerFormatCitation,
  deps: MessageHandlerDeps,
): Promise<EmbedBuilder> {
  const botDefault = deps.config.DEFAULT_TEXT_FORMAT;

  if (!message.guild) {
    return buildErrorEmbed(
      "Server format preferences can only be viewed or changed in a server.",
    );
  }

  const guildId = message.guild.id;
  const guildFormat = deps.guildFormats.get(guildId);

  if (citation.action === "show") {
    return buildServerFormatShowEmbed(guildFormat, botDefault);
  }

  switch (citation.action) {
    case "set":
      await deps.guildFormats.set(guildId, citation.format!, message.author.id);
      return buildServerFormatSetEmbed(citation.format!);
    case "reset":
      await deps.guildFormats.clear(guildId);
      return buildServerFormatResetEmbed(botDefault);
  }
}

async function appendBibleCitationUnit(
  message: Message,
  deps: MessageHandlerDeps,
  units: CitationUnit[],
  bibleCitations: ParsedBibleCitation[],
  lookup: VerseLookup,
  defaultTranslation: Translation,
  textFormat: TextFormat,
): Promise<void> {
  if (bibleCitations.length === 0) {
    return;
  }

  const result = buildBibleCitationEmbedsForMany(
    bibleCitations,
    lookup,
    defaultTranslation,
    textFormat,
    deps.poetryLayout,
  );

  if (result.embeds.length === 0) {
    return;
  }

  if (message.guild) {
    await deps.guildAnalytics.recordCitations(
      message.guild.id,
      bibleCitations,
    );
  }

  units.push({
    embeds: result.embeds,
    threadName: result.threadName,
  });
}

async function appendConfessionDiffCitationUnit(
  units: CitationUnit[],
  citation: ParsedConfessionDiffCitation,
  confessionLookup: ConfessionLookup,
): Promise<void> {
  const result = await buildConfessionDiffEmbeds(citation, confessionLookup);

  if ("error" in result) {
    units.push({ embeds: [buildErrorEmbed(result.error)] });
    return;
  }

  units.push({
    embeds: result.embeds,
    files: confessionDiffAttachments(result.files),
    threadName: result.threadName,
  });
}

function appendConfessionCitationUnit(
  units: CitationUnit[],
  citation: ParsedConfessionCitation,
  confessionLookup: ConfessionLookup,
): void {
  const result = buildConfessionCitationEmbeds(citation, confessionLookup);

  if ("error" in result) {
    units.push({ embeds: [buildErrorEmbed(result.error)] });
    return;
  }

  units.push({
    embeds: result.embeds,
    threadName: result.threadName,
  });
}

export function registerMessageHandler(
  client: Client,
  deps: MessageHandlerDeps,
): void {
  client.on(Events.MessageCreate, (message) => {
    void handleMessage(client, message, deps);
  });
}

async function handleMessage(
  client: Client,
  message: Message,
  deps: MessageHandlerDeps,
): Promise<void> {
  if (message.author.bot || !message.content) {
    return;
  }

  const citations = findBracketCitations(message.content);
  if (citations.length === 0) {
    return;
  }

  const defaultTranslation = resolveDefaultTranslation(
    { userId: message.author.id, guildId: message.guild?.id ?? null },
    deps,
  );
  const defaultTextFormat = resolveDefaultTextFormat(
    { userId: message.author.id, guildId: message.guild?.id ?? null },
    deps,
  );
  const units: CitationUnit[] = [];
  let pendingBibleCitations: ParsedBibleCitation[] = [];

  for (const citation of citations) {
    switch (citation.kind) {
      case "bible":
        pendingBibleCitations.push(citation);
        break;
      default:
        await appendBibleCitationUnit(
          message,
          deps,
          units,
          pendingBibleCitations,
          deps.lookup,
          defaultTranslation,
          defaultTextFormat,
        );
        pendingBibleCitations = [];

        switch (citation.kind) {
          case "confessionDiff":
            await appendConfessionDiffCitationUnit(
              units,
              citation,
              deps.confessionLookup,
            );
            break;
          case "confession":
            appendConfessionCitationUnit(
              units,
              citation,
              deps.confessionLookup,
            );
            break;
          case "help":
            units.push({
              embeds: [
                buildHelpEmbed(defaultTranslation, defaultTextFormat),
              ],
            });
            break;
          case "status":
            units.push({ embeds: [buildStatusEmbed(client, deps.startedAt)] });
            break;
          case "serverStatus":
            if (!message.guild) {
              units.push({
                embeds: [
                  buildErrorEmbed(
                    "Server status can only be viewed in a server.",
                  ),
                ],
              });
              break;
            }

            units.push({
              embeds: [await buildServerStatusEmbedForMessage(message, deps)],
            });
            break;
          case "format":
            units.push({
              embeds: [
                await buildFormatPreferenceEmbed(message, citation, deps),
              ],
            });
            break;
          case "serverFormat":
            units.push({
              embeds: [
                await buildServerFormatPreferenceEmbed(message, citation, deps),
              ],
            });
            break;
          case "error":
            units.push({ embeds: [buildErrorEmbed(citation.message)] });
            break;
        }
        break;
    }
  }

  await appendBibleCitationUnit(
    message,
    deps,
    units,
    pendingBibleCitations,
    deps.lookup,
    defaultTranslation,
    defaultTextFormat,
  );

  try {
    for (const unit of units) {
      await sendCitationUnit(message, unit);
    }
  } catch (error) {
    console.error("Failed to send citation reply:", error);
  }
}
