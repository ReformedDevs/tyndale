import { type EmbedBuilder } from "discord.js";

import { createTyndaleEmbed } from "../citations/bible/format.js";
import type { SpurgeonDevotionalEntry } from "./spurgeon-lookup.js";

const DEVOTIONAL_EMBED_BUFFER = 4000;
const DEVOTIONAL_FOOTER = "Morning & Evening · C. H. Spurgeon";
const EPIGRAPH_PATTERN = /^[“"']/;

/** Bold + italic — the strongest emphasis Discord embed descriptions support. */
function emphasizeScriptureLine(text: string): string {
  return `***${text.trim()}***`;
}

function formatReference(reference: string): string {
  return ["", emphasizeScriptureLine(reference), ""].join("\n");
}

function formatParagraph(paragraph: string, index: number): string {
  const trimmed = paragraph.trim();

  if (index === 0 && EPIGRAPH_PATTERN.test(trimmed)) {
    return ["", emphasizeScriptureLine(trimmed), ""].join("\n");
  }

  return trimmed;
}

export function formatDevotionalParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph, index) => formatParagraph(paragraph, index))
    .join("\n\n");
}

function takeTextChunk(
  text: string,
  maxSize: number,
): { chunk: string; rest: string } {
  if (text.length <= maxSize) {
    return { chunk: text, rest: "" };
  }

  let splitAt = text.lastIndexOf("\n\n", maxSize);
  if (splitAt <= maxSize * 0.5) {
    splitAt = text.lastIndexOf(" ", maxSize);
  }
  if (splitAt <= 0) {
    splitAt = maxSize;
  }

  return {
    chunk: text.slice(0, splitAt).trimEnd(),
    rest: text.slice(splitAt).trimStart(),
  };
}

function splitDevotionalDescription(
  header: string,
  paragraphs: string[],
): string[] {
  const formattedParagraphs = paragraphs.map((paragraph, index) =>
    formatParagraph(paragraph, index),
  );

  const chunks: string[] = [];
  let currentParts: string[] = header.trim() ? [header.trimEnd()] : [];

  const flush = (): void => {
    if (currentParts.length === 0) {
      return;
    }

    chunks.push(currentParts.join("\n\n"));
    currentParts = [];
  };

  for (const paragraph of formattedParagraphs) {
    const candidate = [...currentParts, paragraph].join("\n\n");

    if (candidate.length <= DEVOTIONAL_EMBED_BUFFER) {
      currentParts.push(paragraph);
      continue;
    }

    flush();

    if (paragraph.length <= DEVOTIONAL_EMBED_BUFFER) {
      currentParts = [paragraph];
      continue;
    }

    let remaining = paragraph;
    while (remaining.length > 0) {
      const { chunk, rest } = takeTextChunk(remaining, DEVOTIONAL_EMBED_BUFFER);
      chunks.push(chunk);
      remaining = rest;
    }
  }

  flush();
  return chunks.length > 0 ? chunks : [header.trimEnd()].filter(Boolean);
}

export function buildSpurgeonDevotionalEmbeds(
  entry: SpurgeonDevotionalEntry,
): EmbedBuilder[] {
  const header = entry.reference.trim() ? formatReference(entry.reference) : "";
  const descriptions = splitDevotionalDescription(header, entry.paragraphs);

  return descriptions.map((description, index) => {
    const embed = createTyndaleEmbed(
      description,
      index === descriptions.length - 1 ? DEVOTIONAL_FOOTER : undefined,
    );

    if (index === 0) {
      embed.setTitle(entry.title);
    }

    return embed;
  });
}

/** @deprecated Prefer buildSpurgeonDevotionalEmbeds for multi-embed support. */
export function formatSpurgeonDevotionalEmbed(
  entry: SpurgeonDevotionalEntry,
): EmbedBuilder {
  return buildSpurgeonDevotionalEmbeds(entry)[0]!;
}

export function getDevotionalThreadName(entry: SpurgeonDevotionalEntry): string {
  return entry.title.slice(0, 100);
}
