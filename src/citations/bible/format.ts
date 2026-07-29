import { EmbedBuilder } from "discord.js";

import type { ParsedBibleCitation } from "../types.js";
import type { Translation, VerseLookup } from "./lookup.js";

const DISCORD_MESSAGE_LIMIT = 1900;
/** Per-embed description cap (Discord max 4096; 6000 total chars allowed per message). */
const DISCORD_EMBED_DESCRIPTION_BUFFER = 4000;
const EMBED_COLOR = 0xb59b3c;

function isContiguous(verses: number[]): boolean {
  for (let index = 1; index < verses.length; index += 1) {
    if (verses[index] !== verses[index - 1]! + 1) {
      return false;
    }
  }

  return true;
}

export function formatReferenceLabel(
  bookName: string,
  chapter: number,
  verses: number[],
): string {
  const sorted = [...verses].sort((left, right) => left - right);

  if (sorted.length === 1) {
    return `${bookName} ${chapter}:${sorted[0]}`;
  }

  if (isContiguous(sorted)) {
    return `${bookName} ${chapter}:${sorted[0]}-${sorted.at(-1)}`;
  }

  return `${bookName} ${chapter}:${sorted.join(",")}`;
}

export function formatCitationFooter(
  label: string,
  translationLabel: string,
): string {
  return `*${label} · ${translationLabel}*`;
}

function formatVerseLine(verse: number, text: string): string {
  return `**${verse}.** ${text}`;
}

function formatQuoteBlock(lines: string[]): string {
  return `> ${lines.join(" ")}`;
}

interface BibleCitationContent {
  label: string;
  translationLabel: string;
  verseLines: string[];
}

interface BibleCitationError {
  error: string;
}

function resolveBibleCitationContent(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
): BibleCitationContent | BibleCitationError {
  const translation = citation.translation ?? defaultTranslation;
  const verses = lookup.expandVerses(
    translation,
    citation.book,
    citation.chapter,
    citation.verses,
    citation.chapterEndFrom,
  );

  if (!verses || verses.length === 0) {
    const label = formatReferenceLabel(
      citation.bookName,
      citation.chapter,
      citation.chapterEndFrom !== undefined
        ? [citation.chapterEndFrom]
        : citation.verses,
    );
    return {
      error: `_${label} not found in ${translation.toUpperCase()}_`,
    };
  }

  const label = formatReferenceLabel(
    citation.bookName,
    citation.chapter,
    verses,
  );
  const translationLabel = translation.toUpperCase();
  const verseLines: string[] = [];

  for (const verse of verses) {
    const text = lookup.getVerse(
      translation,
      citation.book,
      citation.chapter,
      verse,
    );

    if (!text) {
      return {
        error: `_${label} not found in ${translationLabel}_`,
      };
    }

    verseLines.push(formatVerseLine(verse, text));
  }

  return { label, translationLabel, verseLines };
}

export function resolveBibleCitation(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
): string {
  const content = resolveBibleCitationContent(
    citation,
    lookup,
    defaultTranslation,
  );

  if ("error" in content) {
    return content.error;
  }

  return `${formatQuoteBlock(content.verseLines)}\n\n${formatCitationFooter(content.label, content.translationLabel)}`;
}

export function getCitationThreadName(
  label: string,
  translationLabel: string,
): string {
  return `${label} · ${translationLabel}`.slice(0, 100);
}

function createCitationEmbed(
  description: string,
  footer?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(description);

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

export interface BibleCitationEmbedResult {
  embeds: EmbedBuilder[];
  threadName: string;
}

export function buildBibleCitationEmbeds(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
): BibleCitationEmbedResult | BibleCitationError {
  const content = resolveBibleCitationContent(
    citation,
    lookup,
    defaultTranslation,
  );

  if ("error" in content) {
    return content;
  }

  const footer = `${content.label} · ${content.translationLabel}`;
  const embeds: EmbedBuilder[] = [];
  let batch: string[] = [];
  let batchLength = 0;

  for (const line of content.verseLines) {
    const addition = batch.length === 0 ? line.length : line.length + 1;

    if (
      batchLength + addition > DISCORD_EMBED_DESCRIPTION_BUFFER &&
      batch.length > 0
    ) {
      embeds.push(createCitationEmbed(batch.join(" ")));
      batch = [line];
      batchLength = line.length;
      continue;
    }

    batch.push(line);
    batchLength += addition;
  }

  if (batch.length > 0) {
    embeds.push(createCitationEmbed(batch.join(" "), footer));
  } else if (embeds.length > 0) {
    embeds.at(-1)?.setFooter({ text: footer });
  }

  return {
    embeds,
    threadName: getCitationThreadName(content.label, content.translationLabel),
  };
}

/** @deprecated Prefer buildBibleCitationEmbeds for multi-embed support. */
export function buildBibleCitationEmbed(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
): EmbedBuilder | null {
  const result = buildBibleCitationEmbeds(citation, lookup, defaultTranslation);

  if ("error" in result) {
    return null;
  }

  if (result.embeds.length !== 1) {
    return null;
  }

  return result.embeds[0] ?? null;
}

export function splitDiscordMessages(
  content: string,
  limit = DISCORD_MESSAGE_LIMIT,
): string[] {
  if (content.length <= limit) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt <= 0) {
      splitAt = limit;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
