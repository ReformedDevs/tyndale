import { Events, type Client, type Message } from "discord.js";

import {
  resolveBibleCitation,
  splitDiscordMessages,
} from "../../citations/bible/format.js";
import { findBracketCitations } from "../../citations/bible/parser.js";
import type { VerseLookup } from "../../citations/bible/lookup.js";
import type { Config } from "../../config.js";
import { formatStatusReply } from "./ops.js";

export interface MessageHandlerDeps {
  config: Config;
  lookup: VerseLookup;
  startedAt: number;
}

async function sendReply(message: Message, chunks: string[]): Promise<void> {
  if (chunks.length === 0) {
    return;
  }

  await message.reply(chunks[0]!);

  if (chunks.length === 1) {
    return;
  }

  const channel = message.channel;
  if (!channel.isSendable()) {
    return;
  }

  for (const chunk of chunks.slice(1)) {
    await channel.send(chunk);
  }
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

  const parts: string[] = [];

  for (const citation of citations) {
    switch (citation.kind) {
      case "status":
        parts.push(formatStatusReply(client, deps.startedAt));
        break;
      case "error":
        parts.push(citation.message);
        break;
      case "bible":
        parts.push(
          resolveBibleCitation(
            citation,
            deps.lookup,
            deps.config.DEFAULT_TRANSLATION,
          ),
        );
        break;
    }
  }

  const reply = parts.join("\n\n");
  const chunks = splitDiscordMessages(reply);

  try {
    await sendReply(message, chunks);
  } catch (error) {
    console.error("Failed to send citation reply:", error);
  }
}
