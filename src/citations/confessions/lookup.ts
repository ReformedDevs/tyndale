import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ConfessionLocation } from "../types.js";

export const CONFESSIONS = ["wcf", "lbcf"] as const;
export type Confession = (typeof CONFESSIONS)[number];

export interface ConfessionParagraphEntry {
  chapterTitle: string;
  text: string;
}

export interface ConfessionDocument {
  title: string;
  abbrev: string;
  entries: Record<string, ConfessionParagraphEntry>;
}

function entryKey(chapter: number, paragraph: number): string {
  return `${chapter}:${paragraph}`;
}

export function isConfession(value: string): value is Confession {
  return (CONFESSIONS as readonly string[]).includes(value.toLowerCase());
}

export function normalizeConfession(value: string): Confession | undefined {
  const normalized = value.toLowerCase();
  return isConfession(normalized) ? normalized : undefined;
}

export function formatConfessionCodes(): string {
  return CONFESSIONS.map((confession) => confession.toUpperCase()).join(", ");
}

export class ConfessionLookup {
  private constructor(
    private readonly documents: Record<Confession, ConfessionDocument>,
    private readonly paragraphCounts: Record<
      Confession,
      Record<number, number>
    >,
  ) {}

  static async load(dataDir: string): Promise<ConfessionLookup> {
    const documents = {} as Record<Confession, ConfessionDocument>;

    for (const confession of CONFESSIONS) {
      const filePath = path.join(dataDir, `${confession}.json`);
      const raw = await readFile(filePath, "utf8");
      documents[confession] = JSON.parse(raw) as ConfessionDocument;
    }

    return ConfessionLookup.fromDocuments(documents);
  }

  static fromDocuments(
    documents: Record<Confession, ConfessionDocument>,
  ): ConfessionLookup {
    const paragraphCounts = {} as Record<
      Confession,
      Record<number, number>
    >;

    for (const confession of CONFESSIONS) {
      const counts: Record<number, number> = {};
      const document = documents[confession];

      for (const key of Object.keys(document.entries)) {
        const [chapterText, paragraphText] = key.split(":");
        const chapter = Number.parseInt(chapterText ?? "", 10);
        const paragraph = Number.parseInt(paragraphText ?? "", 10);
        if (Number.isNaN(chapter) || Number.isNaN(paragraph)) {
          continue;
        }

        counts[chapter] = Math.max(counts[chapter] ?? 0, paragraph);
      }

      paragraphCounts[confession] = counts;
    }

    return new ConfessionLookup(documents, paragraphCounts);
  }

  getDocument(confession: Confession): ConfessionDocument {
    return this.documents[confession];
  }

  getParagraph(
    confession: Confession,
    chapter: number,
    paragraph: number,
  ): ConfessionParagraphEntry | undefined {
    return this.documents[confession].entries[entryKey(chapter, paragraph)];
  }

  getParagraphCount(confession: Confession, chapter: number): number {
    return this.paragraphCounts[confession][chapter] ?? 0;
  }

  expandRange(
    confession: Confession,
    startChapter: number,
    startParagraph: number,
    endChapter: number,
    endParagraph: number,
  ): ConfessionLocation[] | { error: string } {
    if (
      startChapter > endChapter ||
      (startChapter === endChapter && startParagraph > endParagraph)
    ) {
      return { error: "Invalid paragraph range." };
    }

    const locations: ConfessionLocation[] = [];

    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const paragraphCount = this.getParagraphCount(confession, chapter);
      if (paragraphCount === 0) {
        return {
          error: `Chapter ${chapter} is not in ${this.documents[confession].abbrev}.`,
        };
      }

      const firstParagraph = chapter === startChapter ? startParagraph : 1;
      const lastParagraph =
        chapter === endChapter ? endParagraph : paragraphCount;

      if (lastParagraph > paragraphCount) {
        return {
          error: `Paragraph ${lastParagraph} is beyond chapter ${chapter} in ${this.documents[confession].abbrev}.`,
        };
      }

      for (
        let paragraph = firstParagraph;
        paragraph <= lastParagraph;
        paragraph += 1
      ) {
        if (!this.getParagraph(confession, chapter, paragraph)) {
          return {
            error: `${this.documents[confession].abbrev} ${chapter}.${paragraph} was not found.`,
          };
        }

        locations.push({ chapter, paragraph });
      }
    }

    return locations;
  }
}
