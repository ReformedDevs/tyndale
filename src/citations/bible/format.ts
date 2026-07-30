import { EmbedBuilder } from "discord.js";

import type { ParsedBibleCitation } from "../types.js";
import type { VerseLookup, Translation } from "./lookup.js";
import { usesVersePerLineProse } from "./lookup.js";
import { formatUsfmCitationLines, PoetryLayoutLookup } from "./poetry-layout.js";
import {
  formatQuoteBlock,
  joinVerseLines,
  resolveVerseLayout,
  type TextFormat,
  type VerseLayout,
} from "./text-format.js";

const DISCORD_MESSAGE_LIMIT = 1900;
/** Per-embed description cap (Discord max 4096; 6000 total chars allowed per message). */
const DISCORD_EMBED_DESCRIPTION_BUFFER = 4000;
const EMBED_COLOR = 0xb59b3c;
const EMPTY_POETRY_LAYOUT = PoetryLayoutLookup.fromIndex({});

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

interface BibleCitationContent {
  label: string;
  translationLabel: string;
  verseLines: string[];
  verseLayout: "paragraph" | "verse" | "usfm";
}

interface BibleCitationError {
  error: string;
}

function resolveBibleCitationContent(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  poetryLayout: PoetryLayoutLookup,
  defaultTranslation: Translation,
  textFormat: TextFormat,
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
  const hasUsfmLayout = poetryLayout.hasBook(translation, citation.book);
  const verseLayout = resolveVerseLayout(
    textFormat,
    citation.book,
    hasUsfmLayout,
  );

  if (verseLayout === "usfm") {
    const usfmLines = formatUsfmCitationLines(
      verses,
      (verse) =>
        poetryLayout.getVerse(translation, citation.book, citation.chapter, verse),
      (verse) =>
        lookup.getVerse(translation, citation.book, citation.chapter, verse),
      {
        proseLayout: usesVersePerLineProse(translation) ? "verse" : "paragraph",
      },
    );

    if (!usfmLines) {
      return {
        error: `_${label} not found in ${translationLabel}_`,
      };
    }

    return {
      label,
      translationLabel,
      verseLines: usfmLines,
      verseLayout,
    };
  }

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

  return {
    label,
    translationLabel,
    verseLines,
    verseLayout,
  };
}

export function resolveBibleCitation(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
  textFormat: TextFormat = "literary",
  poetryLayout: PoetryLayoutLookup = EMPTY_POETRY_LAYOUT,
): string {
  const content = resolveBibleCitationContent(
    citation,
    lookup,
    poetryLayout,
    defaultTranslation,
    textFormat,
  );

  if ("error" in content) {
    return content.error;
  }

  return `${formatQuoteBlock(content.verseLines, content.verseLayout)}\n\n${formatCitationFooter(content.label, content.translationLabel)}`;
}

export function getCitationThreadName(
  label: string,
  translationLabel: string,
): string {
  return `${label} · ${translationLabel}`.slice(0, 100);
}

export function createTyndaleEmbed(
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

const VERSE_START_LINE = /^\*\*\d+(?:\.)?\*\*/;

function splitParagraphLineIntoVerseSegments(line: string): string[] {
  const matches = [...line.matchAll(/\*\*(\d+)(?:\.)?\*\*/g)];

  if (matches.length <= 1) {
    return [line];
  }

  return matches.map((match, index) => {
    const start = match.index!;
    const end =
      index + 1 < matches.length ? matches[index + 1]!.index! : line.length;
    return line.slice(start, end).trim();
  });
}

/** Groups formatted display lines so embed batching never splits mid-verse. */
export function groupDisplayLinesIntoVerseSegments(
  lines: string[],
  layout: VerseLayout,
): string[] {
  if (layout === "paragraph") {
    const segments: string[] = [];

    for (const line of lines) {
      if (line === "") {
        continue;
      }

      segments.push(...splitParagraphLineIntoVerseSegments(line));
    }

    return segments;
  }

  const segments: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line === "") {
      if (current.length > 0) {
        segments.push(current.join("\n"));
        current = [];
      }

      segments.push("");
      continue;
    }

    if (VERSE_START_LINE.test(line) && current.length > 0) {
      segments.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    segments.push(current.join("\n"));
  }

  return segments;
}

function batchLinesIntoEmbeds(lines: string[], lineSeparator: string): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  let batch: string[] = [];
  let batchLength = 0;

  for (const line of lines) {
    const addition =
      batch.length === 0 ? line.length : line.length + lineSeparator.length;

    if (
      batchLength + addition > DISCORD_EMBED_DESCRIPTION_BUFFER &&
      batch.length > 0
    ) {
      embeds.push(createTyndaleEmbed(batch.join(lineSeparator)));
      batch = [line];
      batchLength = line.length;
      continue;
    }

    batch.push(line);
    batchLength += addition;
  }

  if (batch.length > 0) {
    embeds.push(createTyndaleEmbed(batch.join(lineSeparator)));
  }

  return embeds;
}

function buildEmbedsFromVerseSegments(
  segments: string[],
  verseLayout: VerseLayout,
  footer?: string,
): EmbedBuilder[] {
  const segmentSeparator = verseLayout === "paragraph" ? " " : "\n";
  const embeds: EmbedBuilder[] = [];
  let batch: string[] = [];
  let batchLength = 0;

  for (const segment of segments) {
    if (segment === "" && batch.length === 0) {
      continue;
    }

    if (segment.length > DISCORD_EMBED_DESCRIPTION_BUFFER) {
      if (batch.length > 0) {
        embeds.push(createTyndaleEmbed(batch.join(segmentSeparator)));
        batch = [];
        batchLength = 0;
      }

      embeds.push(
        ...batchLinesIntoEmbeds(segment.split("\n"), "\n"),
      );
      continue;
    }

    const addition =
      batch.length === 0
        ? segment.length
        : segment.length + segmentSeparator.length;

    if (
      batchLength + addition > DISCORD_EMBED_DESCRIPTION_BUFFER &&
      batch.length > 0
    ) {
      embeds.push(createTyndaleEmbed(batch.join(segmentSeparator)));
      batch = [segment];
      batchLength = segment.length;
      continue;
    }

    batch.push(segment);
    batchLength += addition;
  }

  if (batch.length > 0) {
    embeds.push(createTyndaleEmbed(batch.join(segmentSeparator), footer));
  } else if (footer && embeds.length > 0) {
    embeds.at(-1)?.setFooter({ text: footer });
  }

  return embeds;
}

function buildEmbedsFromDescriptionParts(parts: string[]): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  let batch: string[] = [];
  let batchLength = 0;

  for (const part of parts) {
    const addition = batch.length === 0 ? part.length : part.length + 2;

    if (
      batchLength + addition > DISCORD_EMBED_DESCRIPTION_BUFFER &&
      batch.length > 0
    ) {
      embeds.push(createTyndaleEmbed(batch.join("\n\n")));
      batch = [part];
      batchLength = part.length;
      continue;
    }

    batch.push(part);
    batchLength += addition;
  }

  if (batch.length > 0) {
    embeds.push(createTyndaleEmbed(batch.join("\n\n")));
  }

  return embeds;
}

function getCombinedThreadName(blocks: BibleCitationContent[]): string {
  if (blocks.length === 0) {
    return "Citations";
  }

  if (blocks.length === 1) {
    const block = blocks[0]!;
    return getCitationThreadName(block.label, block.translationLabel);
  }

  const sharedTranslation = blocks.every(
    (block) => block.translationLabel === blocks[0]!.translationLabel,
  )
    ? blocks[0]!.translationLabel
    : undefined;

  const labels = blocks.map((block) => block.label).join(" · ");
  if (labels.length <= 100) {
    return sharedTranslation ? `${labels} · ${sharedTranslation}` : labels;
  }

  return sharedTranslation
    ? `${blocks.length} citations · ${sharedTranslation}`
    : `${blocks.length} citations`;
}

export function buildBibleCitationEmbedsForMany(
  citations: ParsedBibleCitation[],
  lookup: VerseLookup,
  defaultTranslation: Translation,
  textFormat: TextFormat = "literary",
  poetryLayout: PoetryLayoutLookup = EMPTY_POETRY_LAYOUT,
): BibleCitationEmbedResult {
  if (citations.length === 0) {
    return { embeds: [], threadName: "Citations" };
  }

  if (citations.length === 1) {
    const result = buildBibleCitationEmbeds(
      citations[0]!,
      lookup,
      defaultTranslation,
      textFormat,
      poetryLayout,
    );

    if ("error" in result) {
      return {
        embeds: [createTyndaleEmbed(result.error)],
        threadName: "Citation",
      };
    }

    return result;
  }

  const blocks: BibleCitationContent[] = [];
  const errorLines: string[] = [];

  for (const citation of citations) {
    const content = resolveBibleCitationContent(
      citation,
      lookup,
      poetryLayout,
      defaultTranslation,
      textFormat,
    );

    if ("error" in content) {
      errorLines.push(content.error);
      continue;
    }

    blocks.push(content);
  }

  if (blocks.length === 0) {
    return {
      embeds: [createTyndaleEmbed(errorLines.join("\n\n"))],
      threadName: "Citations",
    };
  }

  const parts: string[] = [...errorLines];

  for (const block of blocks) {
    if (parts.length > 0) {
      parts.push("---");
    }

    parts.push(joinVerseLines(block.verseLines, block.verseLayout));
    parts.push(formatCitationFooter(block.label, block.translationLabel));
  }

  return {
    embeds: buildEmbedsFromDescriptionParts(parts),
    threadName: getCombinedThreadName(blocks),
  };
}

export function buildBibleCitationEmbeds(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
  textFormat: TextFormat = "literary",
  poetryLayout: PoetryLayoutLookup = EMPTY_POETRY_LAYOUT,
): BibleCitationEmbedResult | BibleCitationError {
  const content = resolveBibleCitationContent(
    citation,
    lookup,
    poetryLayout,
    defaultTranslation,
    textFormat,
  );

  if ("error" in content) {
    return content;
  }

  const footer = `${content.label} · ${content.translationLabel}`;
  const segments = groupDisplayLinesIntoVerseSegments(
    content.verseLines,
    content.verseLayout,
  );
  const embeds = buildEmbedsFromVerseSegments(
    segments,
    content.verseLayout,
    footer,
  );

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
  textFormat: TextFormat = "literary",
  poetryLayout: PoetryLayoutLookup = EMPTY_POETRY_LAYOUT,
): EmbedBuilder | null {
  const result = buildBibleCitationEmbeds(
    citation,
    lookup,
    defaultTranslation,
    textFormat,
    poetryLayout,
  );

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
