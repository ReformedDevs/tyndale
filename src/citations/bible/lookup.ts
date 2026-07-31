import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { verseKey, type BookSlug } from "./books.js";

let runtimeTranslations: readonly string[] = [];

export function setRuntimeTranslations(ids: readonly string[]): void {
  runtimeTranslations = [...ids].map((id) => id.toLowerCase()).sort();
}

export function getRuntimeTranslations(): readonly string[] {
  return runtimeTranslations;
}

export type Translation = string;

export function isTranslation(value: string): value is Translation {
  return runtimeTranslations.includes(value.toLowerCase());
}

export function normalizeTranslation(value: string): Translation | undefined {
  const normalized = value.toLowerCase();
  return isTranslation(normalized) ? normalized : undefined;
}

export function formatTranslationCodes(): string {
  return runtimeTranslations
    .map((translation) => translation.toUpperCase())
    .join(", ");
}

/** YLT is traditionally printed with one verse per line; match that in literary mode. */
export function usesVersePerLineProse(translation: Translation): boolean {
  return translation === "ylt";
}

export type VerseIndex = Record<string, string>;
type ChapterVerseCounts = Record<string, number>;

export interface BibleVerseLocation {
  chapter: number;
  verse: number;
}

function buildChapterVerseCounts(index: VerseIndex): ChapterVerseCounts {
  const counts: ChapterVerseCounts = {};

  for (const key of Object.keys(index)) {
    const [book, chapter, verse] = key.split(".");
    if (!book || !chapter || !verse) {
      continue;
    }

    const chapterKey = `${book}.${chapter}`;
    const verseNumber = Number.parseInt(verse, 10);
    counts[chapterKey] = Math.max(counts[chapterKey] ?? 0, verseNumber);
  }

  return counts;
}

async function discoverTranslationIds(biblesDir: string): Promise<string[]> {
  const files = await readdir(biblesDir);
  return files
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.slice(0, -".json".length))
    .sort();
}

export class VerseLookup {
  private constructor(
    private readonly indexes: Record<string, VerseIndex>,
    private readonly chapterVerseCounts: Record<string, ChapterVerseCounts>,
  ) {}

  static async load(biblesDir: string): Promise<VerseLookup> {
    const translationIds = await discoverTranslationIds(biblesDir);
    if (translationIds.length === 0) {
      throw new Error(
        `No bible translations found in ${biblesDir}. Run npm run sync-content first.`,
      );
    }

    setRuntimeTranslations(translationIds);

    const indexes: Record<string, VerseIndex> = {};
    const chapterVerseCounts: Record<string, ChapterVerseCounts> = {};

    for (const translation of translationIds) {
      const filePath = path.join(biblesDir, `${translation}.json`);
      const raw = await readFile(filePath, "utf8");
      indexes[translation] = JSON.parse(raw) as VerseIndex;
      chapterVerseCounts[translation] = buildChapterVerseCounts(
        indexes[translation],
      );
    }

    return new VerseLookup(indexes, chapterVerseCounts);
  }

  static fromIndexes(
    indexes: Record<string, VerseIndex>,
  ): VerseLookup {
    setRuntimeTranslations(Object.keys(indexes));
    const chapterVerseCounts: Record<string, ChapterVerseCounts> = {};

    for (const translation of Object.keys(indexes)) {
      const index = indexes[translation];
      if (!index) {
        continue;
      }
      chapterVerseCounts[translation] = buildChapterVerseCounts(index);
    }

    return new VerseLookup(indexes, chapterVerseCounts);
  }

  availableTranslations(): readonly string[] {
    return getRuntimeTranslations();
  }

  getChapterVerseCount(
    translation: Translation,
    book: BookSlug,
    chapter: number,
  ): number | undefined {
    return this.chapterVerseCounts[translation]?.[`${book}.${chapter}`];
  }

  expandVerses(
    translation: Translation,
    book: BookSlug,
    chapter: number,
    verses: number[],
    chapterEndFrom?: number,
  ): number[] | undefined {
    if (chapterEndFrom === undefined) {
      return verses;
    }

    const lastVerse = this.getChapterVerseCount(translation, book, chapter);
    if (!lastVerse || chapterEndFrom > lastVerse) {
      return undefined;
    }

    return Array.from(
      { length: lastVerse - chapterEndFrom + 1 },
      (_, index) => chapterEndFrom + index,
    );
  }

  expandRange(
    translation: Translation,
    book: BookSlug,
    startChapter: number,
    startVerse: number,
    endChapter: number,
    endVerse: number,
  ): BibleVerseLocation[] | undefined {
    if (
      startChapter > endChapter ||
      (startChapter === endChapter && startVerse > endVerse)
    ) {
      return undefined;
    }

    const locations: BibleVerseLocation[] = [];

    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const lastVerse = this.getChapterVerseCount(translation, book, chapter);
      if (!lastVerse) {
        return undefined;
      }

      const firstVerse = chapter === startChapter ? startVerse : 1;
      const lastInRange = chapter === endChapter ? endVerse : lastVerse;

      if (firstVerse > lastVerse || lastInRange > lastVerse) {
        return undefined;
      }

      for (let verse = firstVerse; verse <= lastInRange; verse += 1) {
        if (!this.getVerse(translation, book, chapter, verse)) {
          return undefined;
        }

        locations.push({ chapter, verse });
      }
    }

    return locations;
  }

  expandChapterRange(
    translation: Translation,
    book: BookSlug,
    startChapter: number,
    endChapter: number,
  ): BibleVerseLocation[] | undefined {
    if (startChapter > endChapter) {
      return undefined;
    }

    const locations: BibleVerseLocation[] = [];

    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const lastVerse = this.getChapterVerseCount(translation, book, chapter);
      if (!lastVerse) {
        return undefined;
      }

      for (let verse = 1; verse <= lastVerse; verse += 1) {
        if (!this.getVerse(translation, book, chapter, verse)) {
          return undefined;
        }

        locations.push({ chapter, verse });
      }
    }

    return locations;
  }

  getVerse(
    translation: Translation,
    book: BookSlug,
    chapter: number,
    verse: number,
  ): string | undefined {
    return this.indexes[translation]?.[verseKey(book, chapter, verse)];
  }

  hasTranslation(translation: string): translation is Translation {
    return isTranslation(translation);
  }
}
