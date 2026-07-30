import {
  EmbedBuilder,
  Events,
  ThreadAutoArchiveDuration,
  type Client,
  type Message,
  type SendableChannels,
} from "discord.js";

import { buildBibleCitationEmbedsForMany } from "../../citations/bible/format.js";
import { findBracketCitations } from "../../citations/bible/parser.js";
import type { VerseLookup, Translation } from "../../citations/bible/lookup.js";
import type {
  ParsedBibleCitation,
  ParsedServerTranslationCitation,
  ParsedTranslationCitation,
} from "../../citations/types.js";
import type { Config } from "../../config.js";
import type { GuildAnalyticsStore } from "../../preferences/guild-analytics.js";
import type { GuildTranslationStore } from "../../preferences/guild-translations.js";
import type { UserTranslationStore } from "../../preferences/user-translations.js";
import {
  buildErrorEmbed,
  buildHelpEmbed,
  buildServerTranslationResetEmbed,
  buildServerTranslationSetEmbed,
  buildServerTranslationShowEmbed,
  buildServerStatusEmbed,
  buildStatusEmbed,
  buildTranslationResetEmbed,
  buildTranslationSetEmbed,
  buildTranslationShowEmbed,
} from "./ops.js";

export interface MessageHandlerDeps {
  config: Config;
  lookup: VerseLookup;
  userTranslations: UserTranslationStore;
  guildTranslations: GuildTranslationStore;
  guildAnalytics: GuildAnalyticsStore;
  startedAt: number;
}

type CitationUnit = {
  embeds: EmbedBuilder[];
  threadName?: string;
};

/** Reply with connector UI but without @mentioning / highlighting the author. */
async function replyWithoutPing(
  message: Message,
  options: { embeds: EmbedBuilder[] },
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

async function continueInThread(
  anchor: Message,
  threadName: string,
  sendRemaining: (target: SendableChannels) => Promise<void>,
): Promise<void> {
  if (!anchor.guild) {
    await sendRemaining(anchor.channel as SendableChannels);
    return;
  }

  const thread = await anchor.startThread({
    name: threadName.slice(0, 100),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
  });

  await sendRemaining(thread);
}

async function sendCitationUnit(
  message: Message,
  unit: CitationUnit,
): Promise<void> {
  const [firstEmbed, ...remainingEmbeds] = unit.embeds;
  if (!firstEmbed) {
    return;
  }

  const firstMessage = await replyWithoutPing(message, {
    embeds: [firstEmbed],
  });

  if (remainingEmbeds.length === 0) {
    return;
  }

  await continueInThread(
    firstMessage,
    unit.threadName ?? "Citation continued",
    async (target) => {
      await sendEmbedsSequentially(target, remainingEmbeds);
    },
  );
}

function getGuildTranslation(
  message: Message,
  deps: MessageHandlerDeps,
): Translation | undefined {
  if (!message.guild) {
    return undefined;
  }

  return deps.guildTranslations.get(message.guild.id);
}

function resolveDefaultTranslation(
  message: Message,
  deps: MessageHandlerDeps,
): Translation {
  const userTranslation = deps.userTranslations.get(message.author.id);
  if (userTranslation) {
    return userTranslation;
  }

  const guildTranslation = getGuildTranslation(message, deps);
  if (guildTranslation) {
    return guildTranslation;
  }

  return deps.config.DEFAULT_TRANSLATION;
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
  const analytics = deps.guildAnalytics.getSummary(guildId);

  return buildServerStatusEmbed({
    guildTranslation: guildPreference?.translation,
    guildDefaultSetAt: guildPreference?.setAt || undefined,
    guildDefaultSetBy: guildPreference?.setBy
      ? await resolveMemberLabel(message, guildPreference.setBy)
      : undefined,
    botDefault: deps.config.DEFAULT_TRANSLATION,
    memberOverrideCount: deps.userTranslations.countForGuild(guildId),
    citationsTotal: analytics.citationsTotal,
    citationsThisWeek: analytics.citationsThisWeek,
    topBooks: analytics.topBooks,
  });
}

async function buildTranslationPreferenceEmbed(
  message: Message,
  citation: ParsedTranslationCitation,
  deps: MessageHandlerDeps,
): Promise<EmbedBuilder> {
  const userId = message.author.id;
  const botDefault = deps.config.DEFAULT_TRANSLATION;
  const guildTranslation = getGuildTranslation(message, deps);

  switch (citation.action) {
    case "show":
      return buildTranslationShowEmbed(
        deps.userTranslations.get(userId),
        guildTranslation,
        botDefault,
      );
    case "set":
      await deps.userTranslations.set(
        userId,
        citation.translation!,
        message.guild?.id,
      );
      return buildTranslationSetEmbed(citation.translation!);
    case "reset":
      await deps.userTranslations.clear(userId);
      return buildTranslationResetEmbed(guildTranslation, botDefault);
  }
}

async function buildServerTranslationPreferenceEmbed(
  message: Message,
  citation: ParsedServerTranslationCitation,
  deps: MessageHandlerDeps,
): Promise<EmbedBuilder> {
  const botDefault = deps.config.DEFAULT_TRANSLATION;

  if (!message.guild) {
    return buildErrorEmbed(
      "Server translation preferences can only be viewed or changed in a server.",
    );
  }

  const guildId = message.guild.id;
  const guildTranslation = deps.guildTranslations.get(guildId);

  if (citation.action === "show") {
    return buildServerTranslationShowEmbed(guildTranslation, botDefault);
  }

  switch (citation.action) {
    case "set":
      await deps.guildTranslations.set(
        guildId,
        citation.translation!,
        message.author.id,
      );
      return buildServerTranslationSetEmbed(citation.translation!);
    case "reset":
      await deps.guildTranslations.clear(guildId);
      return buildServerTranslationResetEmbed(botDefault);
  }
}

async function appendBibleCitationUnit(
  message: Message,
  deps: MessageHandlerDeps,
  units: CitationUnit[],
  bibleCitations: ParsedBibleCitation[],
  lookup: VerseLookup,
  defaultTranslation: Translation,
): Promise<void> {
  if (bibleCitations.length === 0) {
    return;
  }

  const result = buildBibleCitationEmbedsForMany(
    bibleCitations,
    lookup,
    defaultTranslation,
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

  const defaultTranslation = resolveDefaultTranslation(message, deps);
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
        );
        pendingBibleCitations = [];

        switch (citation.kind) {
          case "help":
            units.push({
              embeds: [buildHelpEmbed(defaultTranslation)],
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
          case "translation":
            units.push({
              embeds: [
                await buildTranslationPreferenceEmbed(message, citation, deps),
              ],
            });
            break;
          case "serverTranslation":
            units.push({
              embeds: [
                await buildServerTranslationPreferenceEmbed(
                  message,
                  citation,
                  deps,
                ),
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
  );

  try {
    for (const unit of units) {
      await sendCitationUnit(message, unit);
    }
  } catch (error) {
    console.error("Failed to send citation reply:", error);
  }
}
