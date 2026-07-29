import {
  EmbedBuilder,
  Events,
  ThreadAutoArchiveDuration,
  type Client,
  type Message,
  type SendableChannels,
} from "discord.js";

import { buildBibleCitationEmbeds, createTyndaleEmbed } from "../../citations/bible/format.js";
import { findBracketCitations } from "../../citations/bible/parser.js";
import type { VerseLookup } from "../../citations/bible/lookup.js";
import type { Config } from "../../config.js";
import {
  buildErrorEmbed,
  buildHelpEmbed,
  buildStatusEmbed,
} from "./ops.js";

export interface MessageHandlerDeps {
  config: Config;
  lookup: VerseLookup;
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

  const units: CitationUnit[] = [];

  for (const citation of citations) {
    switch (citation.kind) {
      case "help":
        units.push({
          embeds: [buildHelpEmbed(deps.config.DEFAULT_TRANSLATION)],
        });
        break;
      case "status":
        units.push({ embeds: [buildStatusEmbed(client, deps.startedAt)] });
        break;
      case "error":
        units.push({ embeds: [buildErrorEmbed(citation.message)] });
        break;
      case "bible": {
        const result = buildBibleCitationEmbeds(
          citation,
          deps.lookup,
          deps.config.DEFAULT_TRANSLATION,
        );

        if ("error" in result) {
          units.push({ embeds: [createTyndaleEmbed(result.error)] });
          break;
        }

        units.push({
          embeds: result.embeds,
          threadName: result.threadName,
        });
        break;
      }
    }
  }

  try {
    for (const unit of units) {
      await sendCitationUnit(message, unit);
    }
  } catch (error) {
    console.error("Failed to send citation reply:", error);
  }
}
