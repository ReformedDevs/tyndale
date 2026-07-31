import { AttachmentBuilder, EmbedBuilder } from "discord.js";

import { createTyndaleEmbed } from "../bible/format.js";
import type { ConfessionLocation, ParsedConfessionDiffCitation } from "../types.js";
import {
  renderConfessionDiffPng,
  textsAreIdentical,
} from "./diff-image.js";
import type { Confession, ConfessionLookup } from "./lookup.js";
import { resolveConfessionLocations } from "./parser.js";

export interface ConfessionDiffFile {
  attachment: Buffer;
  name: string;
}

interface ParagraphPair {
  leftLabel: string;
  rightLabel: string;
  leftText?: string;
  rightText?: string;
  chapterTitle?: string;
}

function formatLocationLabel(
  abbrev: string,
  location: ConfessionLocation,
): string {
  return `${abbrev} ${location.chapter}.${location.paragraph}`;
}

function resolveSideLocations(
  confession: Confession,
  citation: ParsedConfessionDiffCitation,
  lookup: ConfessionLookup,
): ConfessionLocation[] | { error: string } {
  const sideCitation = {
    kind: "confession" as const,
    raw: citation.raw,
    confession,
    locations: citation.locations,
    wholeChapter: citation.wholeChapter,
    chapterEndFrom: citation.chapterEndFrom,
    range: citation.range,
  };

  const resolved = resolveConfessionLocations(sideCitation, lookup);
  if ("error" in resolved) {
    return resolved;
  }

  return resolved.locations;
}

function pairParagraphs(
  leftConfession: Confession,
  rightConfession: Confession,
  citation: ParsedConfessionDiffCitation,
  lookup: ConfessionLookup,
): ParagraphPair[] | { error: string } {
  const leftAbbrev = lookup.getDocument(leftConfession).meta.abbrev;
  const rightAbbrev = lookup.getDocument(rightConfession).meta.abbrev;

  const leftLocations = resolveSideLocations(leftConfession, citation, lookup);
  if ("error" in leftLocations) {
    return leftLocations;
  }

  const rightLocations = resolveSideLocations(rightConfession, citation, lookup);
  if ("error" in rightLocations) {
    return rightLocations;
  }

  const pairs: ParagraphPair[] = [];
  const maxLength = Math.max(leftLocations.length, rightLocations.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftLocation = leftLocations[index];
    const rightLocation = rightLocations[index];

    const leftEntry = leftLocation
      ? lookup.getParagraph(
          leftConfession,
          leftLocation.chapter,
          leftLocation.paragraph,
        )
      : undefined;
    const rightEntry = rightLocation
      ? lookup.getParagraph(
          rightConfession,
          rightLocation.chapter,
          rightLocation.paragraph,
        )
      : undefined;

    if (!leftLocation && !rightLocation) {
      continue;
    }

    pairs.push({
      leftLabel: leftLocation
        ? formatLocationLabel(leftAbbrev, leftLocation)
        : `${leftAbbrev} —`,
      rightLabel: rightLocation
        ? formatLocationLabel(rightAbbrev, rightLocation)
        : `${rightAbbrev} —`,
      leftText: leftEntry?.text,
      rightText: rightEntry?.text,
      chapterTitle: leftEntry?.chapterTitle ?? rightEntry?.chapterTitle,
    });
  }

  return pairs;
}

function fileSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function renderPairImage(
  pair: ParagraphPair,
  footer: string,
): Promise<ConfessionDiffFile | { error: string }> {
  if (pair.leftText && pair.rightText) {
    const title = pair.chapterTitle
      ? `${pair.leftLabel} vs ${pair.rightLabel} · ${pair.chapterTitle}`
      : `${pair.leftLabel} vs ${pair.rightLabel}`;

    const attachment = await renderConfessionDiffPng({
      title,
      leftLabel: pair.leftLabel,
      rightLabel: pair.rightLabel,
      leftText: pair.leftText,
      rightText: pair.rightText,
      footer,
    });

    return {
      attachment,
      name: `${fileSlug(pair.leftLabel)}-vs-${fileSlug(pair.rightLabel)}.png`,
    };
  }

  if (pair.leftText || pair.rightText) {
    const presentLabel = pair.leftText ? pair.leftLabel : pair.rightLabel;
    const missingLabel = pair.leftText ? pair.rightLabel : pair.leftLabel;

    const attachment = await renderConfessionDiffPng({
      title: `${pair.leftLabel} vs ${pair.rightLabel}`,
      leftLabel: pair.leftText ? pair.leftLabel : missingLabel,
      rightLabel: pair.rightText ? pair.rightLabel : missingLabel,
      leftText: pair.leftText ?? `(${missingLabel} not present)`,
      rightText: pair.rightText ?? `(${missingLabel} not present)`,
      footer,
    });

    return {
      attachment,
      name: `${fileSlug(presentLabel)}-only.png`,
    };
  }

  return { error: `Nothing to compare for ${pair.leftLabel} vs ${pair.rightLabel}` };
}

export async function buildConfessionDiffEmbeds(
  citation: ParsedConfessionDiffCitation,
  lookup: ConfessionLookup,
): Promise<
  | { embeds: EmbedBuilder[]; files: ConfessionDiffFile[]; threadName: string }
  | { error: string }
> {
  const pairs = pairParagraphs(
    citation.left,
    citation.right,
    citation,
    lookup,
  );

  if ("error" in pairs) {
    return pairs;
  }

  if (pairs.length === 0) {
    return { error: `No paragraphs to compare in ${citation.raw}` };
  }

  const leftAbbrev = lookup.getDocument(citation.left).meta.abbrev;
  const rightAbbrev = lookup.getDocument(citation.right).meta.abbrev;
  const footer = `${leftAbbrev} vs ${rightAbbrev} · same paragraph numbers · topics diverge after ch. 20`;

  const files: ConfessionDiffFile[] = [];
  const embeds: EmbedBuilder[] = [];

  for (const pair of pairs) {
    if (
      pair.leftText &&
      pair.rightText &&
      textsAreIdentical(pair.leftText, pair.rightText)
    ) {
      embeds.push(
        createTyndaleEmbed(
          `__**${pair.leftLabel} vs ${pair.rightLabel}**__${pair.chapterTitle ? ` · ${pair.chapterTitle}` : ""}\n\n_Identical._\n\n${pair.leftText}`,
        ).setFooter({ text: footer }),
      );
      continue;
    }

    const rendered = await renderPairImage(pair, footer);
    if ("error" in rendered) {
      return rendered;
    }

    files.push(rendered);

    const embed = createTyndaleEmbed(
      `__**${pair.leftLabel} vs ${pair.rightLabel}**__${pair.chapterTitle ? ` · ${pair.chapterTitle}` : ""}`,
    )
      .setImage(`attachment://${rendered.name}`)
      .setFooter({ text: footer });
    embeds.push(embed);
  }

  const firstPair = pairs[0]!;
  const threadName =
    pairs.length === 1
      ? `${firstPair.leftLabel} vs ${firstPair.rightLabel}`.slice(0, 100)
      : `${leftAbbrev} vs ${rightAbbrev} comparison`.slice(0, 100);

  return { embeds, files, threadName };
}

export function confessionDiffAttachments(
  files: ConfessionDiffFile[],
): AttachmentBuilder[] {
  return files.map(
    (file) => new AttachmentBuilder(file.attachment, { name: file.name }),
  );
}
