import { EmbedBuilder } from "discord.js";

import type { ConfessionLocation, ParsedConfessionCitation } from "../types.js";
import { createTyndaleEmbed } from "../bible/format.js";
import type { ConfessionLookup } from "./lookup.js";
import { resolveConfessionLocations } from "./parser.js";

const DISCORD_EMBED_DESCRIPTION_BUFFER = 4000;
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;

function splitOversizedText(text: string): string[] {
  if (text.length <= DISCORD_EMBED_DESCRIPTION_BUFFER) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > DISCORD_EMBED_DESCRIPTION_BUFFER) {
    let splitAt = remaining.lastIndexOf(" ", DISCORD_EMBED_DESCRIPTION_BUFFER);
    if (splitAt <= 0) {
      splitAt = DISCORD_EMBED_DESCRIPTION_BUFFER;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function buildEmbedsFromDescriptionParts(parts: string[]): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  let batch: string[] = [];
  let batchLength = 0;

  const flushBatch = (): void => {
    if (batch.length === 0) {
      return;
    }

    embeds.push(createTyndaleEmbed(batch.join("\n\n")));
    batch = [];
    batchLength = 0;
  };

  for (const part of parts) {
    const segments =
      part.length > DISCORD_EMBED_DESCRIPTION_BUFFER
        ? splitOversizedText(part)
        : [part];

    for (const segment of segments) {
      if (segment.length > DISCORD_EMBED_DESCRIPTION_LIMIT) {
        throw new Error(
          `Confession embed segment exceeds Discord limit (${segment.length} chars).`,
        );
      }

      const addition =
        batch.length === 0 ? segment.length : segment.length + 2;

      if (
        batchLength + addition > DISCORD_EMBED_DESCRIPTION_BUFFER &&
        batch.length > 0
      ) {
        flushBatch();
      }

      batch.push(segment);
      batchLength =
        batch.length === 1 ? segment.length : batch.join("\n\n").length;
    }
  }

  flushBatch();

  return embeds;
}

function formatConfessionReferenceLabel(
  abbrev: string,
  citation: ParsedConfessionCitation,
  locations: ParsedConfessionCitation["locations"],
  lookup: ConfessionLookup,
): string {
  if (citation.wholeChapter !== undefined) {
    return `${abbrev} ${citation.wholeChapter}`;
  }

  if (citation.chapterEndFrom) {
    const { chapter, paragraph } = citation.chapterEndFrom;
    if (paragraph === 1) {
      return `${abbrev} ${chapter}.end`;
    }

    return `${abbrev} ${chapter}.${paragraph}-end`;
  }

  const first = locations[0]!;
  const last = locations.at(-1)!;

  if (locations.length === 1) {
    return `${abbrev} ${first.chapter}.${first.paragraph}`;
  }

  const expanded = lookup.expandRange(
    citation.confession,
    first.chapter,
    first.paragraph,
    last.chapter,
    last.paragraph,
  );

  if (!("error" in expanded) && expanded.length === locations.length) {
    if (first.chapter === last.chapter) {
      return `${abbrev} ${first.chapter}.${first.paragraph}-${last.paragraph}`;
    }

    return `${abbrev} ${first.chapter}.${first.paragraph}-${last.chapter}.${last.paragraph}`;
  }

  return locations
    .map((location) => `${abbrev} ${location.chapter}.${location.paragraph}`)
    .join(" · ");
}

function formatDocumentHeader(title: string): string {
  return `__**${title}**__`;
}

function formatSectionHeader(
  chapter: number,
  paragraph: number,
  chapterTitle: string,
): string {
  return `__**${chapter}.${paragraph}. ${chapterTitle}**__`;
}

function formatChapterHeader(chapter: number, chapterTitle: string): string {
  return `__**${chapter}. ${chapterTitle}**__`;
}

function formatParagraphBody(paragraph: number, text: string): string {
  return `**${paragraph}.** ${text}`;
}

function groupLocationsByChapter(
  locations: ConfessionLocation[],
): ConfessionLocation[][] {
  const groups: ConfessionLocation[][] = [];

  for (const location of locations) {
    const lastGroup = groups.at(-1);
    const lastLocation = lastGroup?.at(-1);

    if (
      lastGroup &&
      lastLocation &&
      lastLocation.chapter === location.chapter
    ) {
      lastGroup.push(location);
    } else {
      groups.push([location]);
    }
  }

  return groups;
}

function buildConfessionParts(
  resolved: ParsedConfessionCitation,
  lookup: ConfessionLookup,
  documentTitle: string,
  documentAbbrev: string,
): string[] | { error: string } {
  const locations = resolved.locations;
  if (locations.length === 0) {
    return { error: `No paragraphs specified in ${resolved.raw}` };
  }

  const parts: string[] = [];
  let includeDocumentHeader = true;

  const prependDocumentHeader = (block: string): string => {
    if (!includeDocumentHeader) {
      return block;
    }

    includeDocumentHeader = false;
    return `${formatDocumentHeader(documentTitle)}\n\n${block}`;
  };

  if (locations.length === 1) {
    const location = locations[0]!;
    const entry = lookup.getParagraph(
      resolved.confession,
      location.chapter,
      location.paragraph,
    );

    if (!entry) {
      return {
        error: `${documentAbbrev} ${location.chapter}.${location.paragraph} was not found.`,
      };
    }

    parts.push(
      prependDocumentHeader(
        `${formatSectionHeader(location.chapter, location.paragraph, entry.chapterTitle)}\n\n${entry.text}`,
      ),
    );

    return parts;
  }

  for (const chapterLocations of groupLocationsByChapter(locations)) {
    const chapter = chapterLocations[0]!.chapter;
    const firstEntry = lookup.getParagraph(
      resolved.confession,
      chapter,
      chapterLocations[0]!.paragraph,
    );

    if (!firstEntry) {
      return {
        error: `${documentAbbrev} ${chapter}.${chapterLocations[0]!.paragraph} was not found.`,
      };
    }

    let includeChapterHeader = true;

    for (const location of chapterLocations) {
      const entry = lookup.getParagraph(
        resolved.confession,
        location.chapter,
        location.paragraph,
      );

      if (!entry) {
        return {
          error: `${documentAbbrev} ${location.chapter}.${location.paragraph} was not found.`,
        };
      }

      let chunk = formatParagraphBody(location.paragraph, entry.text);

      if (includeChapterHeader) {
        chunk = `${formatChapterHeader(chapter, firstEntry.chapterTitle)}\n\n${chunk}`;
        includeChapterHeader = false;
      }

      if (includeDocumentHeader) {
        chunk = prependDocumentHeader(chunk);
      }

      parts.push(chunk);
    }
  }

  return parts;
}

export function buildConfessionCitationEmbeds(
  citation: ParsedConfessionCitation,
  lookup: ConfessionLookup,
): { embeds: EmbedBuilder[]; threadName: string } | { error: string } {
  const resolved = resolveConfessionLocations(citation, lookup);

  if ("error" in resolved) {
    return resolved;
  }

  const document = lookup.getDocument(resolved.confession);
  const parts = buildConfessionParts(
    resolved,
    lookup,
    document.title,
    document.abbrev,
  );

  if ("error" in parts) {
    return parts;
  }

  const label = formatConfessionReferenceLabel(
    document.abbrev,
    resolved,
    resolved.locations,
    lookup,
  );
  const footer = `${label} · ${document.title}`;
  const embeds = buildEmbedsFromDescriptionParts(parts);

  if (embeds.length > 0) {
    const lastEmbed = embeds.at(-1)!;
    lastEmbed.setFooter({ text: footer });
  }

  return {
    embeds,
    threadName: footer.slice(0, 100),
  };
}
