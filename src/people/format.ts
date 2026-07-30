import { EmbedBuilder } from "discord.js";

import { createTyndaleEmbed } from "../citations/bible/format.js";
import type { ChurchPersonEntry } from "./types.js";
import { ChurchPeopleLookup } from "./lookup.js";

export function buildPersonNotFoundEmbed(query: string): EmbedBuilder {
  return createTyndaleEmbed(
    `No biography found for **${query.trim()}** in Tyndale's church history index.\n\nTry a reformer, Puritan, or martyr from the seed list, or use \`/person\` autocomplete.`,
  );
}

export function buildPersonDisambiguationEmbed(
  query: string,
  matches: ChurchPersonEntry[],
  lookup: ChurchPeopleLookup,
): EmbedBuilder {
  const lines = matches.map(
    (person, index) =>
      `${index + 1}. **${person.name}** (${lookup.formatCategoryLabels(person)})`,
  );

  return createTyndaleEmbed(
    `Several indexed figures match **${query.trim()}**:\n\n${lines.join("\n")}\n\nRun \`/person\` again with a fuller name.`,
  );
}

export function buildPersonEmbed(
  person: ChurchPersonEntry,
  lookup: ChurchPeopleLookup,
): EmbedBuilder {
  const lines: string[] = [];

  if (person.dates) {
    lines.push(`*${person.dates}*`);
    lines.push("");
  }

  lines.push(person.summary);
  lines.push("");
  lines.push(`[Read more on Wikipedia](${person.wikipediaUrl})`);

  const embed = createTyndaleEmbed(lines.join("\n"))
    .setTitle(person.name)
    .setURL(person.wikipediaUrl)
    .setFooter({
      text: `${lookup.formatCategoryLabels(person)} · ${person.sourceLabel}`,
    });

  if (person.imageUrl) {
    embed.setThumbnail(person.imageUrl);
  }

  return embed;
}
