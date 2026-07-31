import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ConfessionLocation } from "../types.js";

let runtimeConfessions: readonly string[] = [];

export function setRuntimeConfessions(ids: readonly string[]): void {
  runtimeConfessions = [...ids].map((id) => id.toLowerCase()).sort();
}

export function getRuntimeConfessions(): readonly string[] {
  return runtimeConfessions;
}

export type Confession = string;

export interface ConfessionProof {
  marker: number;
  references: string[];
}

export interface ConfessionParagraph {
  number: number;
  text: string;
  textWithMarkers?: string;
  proofs?: ConfessionProof[];
}

export interface ConfessionChapter {
  number: number;
  title: string;
  paragraphs: ConfessionParagraph[];
}

export interface ConfessionMeta {
  id: string;
  kind: string;
  abbrev: string;
  title: string;
  edition?: string;
  year?: number;
  language?: string;
  license?: string;
  tradition?: string;
  authors?: string[];
}

/** christian-standards confession document shape (stored as-is in content/). */
export interface ConfessionDocument {
  meta: ConfessionMeta;
  chapters: ConfessionChapter[];
}

export interface ConfessionParagraphEntry {
  chapter: number;
  chapterTitle: string;
  number: number;
  text: string;
  textWithMarkers?: string;
  proofs?: ConfessionProof[];
}

export function isConfession(value: string): value is Confession {
  return runtimeConfessions.includes(value.toLowerCase());
}

export function normalizeConfession(value: string): Confession | undefined {
  const normalized = value.toLowerCase();
  return isConfession(normalized) ? normalized : undefined;
}

export function formatConfessionCodes(): string {
  return runtimeConfessions
    .map((confession) => confession.toUpperCase())
    .join(", ");
}

export function countConfessionParagraphs(document: ConfessionDocument): number {
  return document.chapters.reduce(
    (total, chapter) => total + chapter.paragraphs.length,
    0,
  );
}

export class ConfessionLookup {
  private constructor(
    private readonly documents: Record<string, ConfessionDocument>,
    private readonly paragraphCounts: Record<string, Record<number, number>>,
  ) {}

  static async load(confessionsDir: string): Promise<ConfessionLookup> {
    const files = await readdir(confessionsDir);
    const confessionIds = files
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.slice(0, -".json".length))
      .sort();

    if (confessionIds.length === 0) {
      throw new Error(
        `No confessions found in ${confessionsDir}. Run npm run sync-content first.`,
      );
    }

    setRuntimeConfessions(confessionIds);

    const documents: Record<string, ConfessionDocument> = {};
    for (const confession of confessionIds) {
      const filePath = path.join(confessionsDir, `${confession}.json`);
      const raw = await readFile(filePath, "utf8");
      documents[confession] = JSON.parse(raw) as ConfessionDocument;
    }

    return ConfessionLookup.fromDocuments(documents);
  }

  static fromDocuments(
    documents: Record<string, ConfessionDocument>,
  ): ConfessionLookup {
    setRuntimeConfessions(Object.keys(documents));

    const paragraphCounts: Record<string, Record<number, number>> = {};

    for (const confession of Object.keys(documents)) {
      const counts: Record<number, number> = {};
      const document = documents[confession]!;

      for (const chapter of document.chapters) {
        for (const paragraph of chapter.paragraphs) {
          counts[chapter.number] = Math.max(
            counts[chapter.number] ?? 0,
            paragraph.number,
          );
        }
      }

      paragraphCounts[confession] = counts;
    }

    return new ConfessionLookup(documents, paragraphCounts);
  }

  availableConfessions(): readonly string[] {
    return getRuntimeConfessions();
  }

  getDocument(confession: Confession): ConfessionDocument {
    const document = this.documents[confession];
    if (!document) {
      throw new Error(`Confession not loaded: ${confession}`);
    }
    return document;
  }

  getChapter(
    confession: Confession,
    chapter: number,
  ): ConfessionChapter | undefined {
    return this.documents[confession]?.chapters.find(
      (entry) => entry.number === chapter,
    );
  }

  getParagraph(
    confession: Confession,
    chapter: number,
    paragraph: number,
  ): ConfessionParagraphEntry | undefined {
    const chapterEntry = this.getChapter(confession, chapter);
    if (!chapterEntry) {
      return undefined;
    }

    const paragraphEntry = chapterEntry.paragraphs.find(
      (entry) => entry.number === paragraph,
    );
    if (!paragraphEntry) {
      return undefined;
    }

    return {
      chapter: chapterEntry.number,
      chapterTitle: chapterEntry.title,
      ...paragraphEntry,
    };
  }

  getParagraphCount(confession: Confession, chapter: number): number {
    return this.paragraphCounts[confession]?.[chapter] ?? 0;
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
    const document = this.getDocument(confession);

    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const paragraphCount = this.getParagraphCount(confession, chapter);
      if (paragraphCount === 0) {
        return {
          error: `Chapter ${chapter} is not in ${document.meta.abbrev}.`,
        };
      }

      const firstParagraph = chapter === startChapter ? startParagraph : 1;
      const lastParagraph =
        chapter === endChapter ? endParagraph : paragraphCount;

      if (lastParagraph > paragraphCount) {
        return {
          error: `Paragraph ${lastParagraph} is beyond chapter ${chapter} in ${document.meta.abbrev}.`,
        };
      }

      for (
        let paragraph = firstParagraph;
        paragraph <= lastParagraph;
        paragraph += 1
      ) {
        if (!this.getParagraph(confession, chapter, paragraph)) {
          return {
            error: `${document.meta.abbrev} ${chapter}.${paragraph} was not found.`,
          };
        }

        locations.push({ chapter, paragraph });
      }
    }

    return locations;
  }
}
