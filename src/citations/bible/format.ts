import type { ParsedBibleCitation } from "../types.js";
import type { Translation, VerseLookup } from "./lookup.js";

const DISCORD_MESSAGE_LIMIT = 1900;

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

export function resolveBibleCitation(
  citation: ParsedBibleCitation,
  lookup: VerseLookup,
  defaultTranslation: Translation,
): string {
  const translation = citation.translation ?? defaultTranslation;
  const label = formatReferenceLabel(
    citation.bookName,
    citation.chapter,
    citation.verses,
  );
  const translationLabel = translation.toUpperCase();
  const lines: string[] = [];

  for (const verse of citation.verses) {
    const text = lookup.getVerse(
      translation,
      citation.book,
      citation.chapter,
      verse,
    );

    if (!text) {
      return `${label} not found in ${translationLabel}`;
    }

    lines.push(`${verse} ${text}`);
  }

  return `**${label}** (${translationLabel})\n${lines.join("\n")}`;
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
