import { readFile } from "node:fs/promises";
import path from "node:path";

import { verseKey, type BookSlug } from "./books.js";

export const TRANSLATIONS = ["web", "asv", "ylt"] as const;
export type Translation = (typeof TRANSLATIONS)[number];

export function isTranslation(value: string): value is Translation {
  return (TRANSLATIONS as readonly string[]).includes(value.toLowerCase());
}

export function normalizeTranslation(value: string): Translation | undefined {
  const normalized = value.toLowerCase();
  return isTranslation(normalized) ? normalized : undefined;
}

export type VerseIndex = Record<string, string>;
type ChapterVerseCounts = Record<string, number>;

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

export class VerseLookup {
  private constructor(
    private readonly indexes: Record<Translation, VerseIndex>,
    private readonly chapterVerseCounts: Record<Translation, ChapterVerseCounts>,
  ) {}

  static async load(dataDir: string): Promise<VerseLookup> {
    const indexes = {} as Record<Translation, VerseIndex>;
    const chapterVerseCounts = {} as Record<Translation, ChapterVerseCounts>;

    for (const translation of TRANSLATIONS) {
      const filePath = path.join(dataDir, `${translation}.json`);
      const raw = await readFile(filePath, "utf8");
      indexes[translation] = JSON.parse(raw) as VerseIndex;
      chapterVerseCounts[translation] = buildChapterVerseCounts(
        indexes[translation],
      );
    }

    return new VerseLookup(indexes, chapterVerseCounts);
  }

  static fromIndexes(indexes: Record<Translation, VerseIndex>): VerseLookup {
    const chapterVerseCounts = {} as Record<Translation, ChapterVerseCounts>;

    for (const translation of TRANSLATIONS) {
      chapterVerseCounts[translation] = buildChapterVerseCounts(
        indexes[translation],
      );
    }

    return new VerseLookup(indexes, chapterVerseCounts);
  }

  getChapterVerseCount(
    translation: Translation,
    book: BookSlug,
    chapter: number,
  ): number | undefined {
    return this.chapterVerseCounts[translation][`${book}.${chapter}`];
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

  getVerse(
    translation: Translation,
    book: BookSlug,
    chapter: number,
    verse: number,
  ): string | undefined {
    return this.indexes[translation][verseKey(book, chapter, verse)];
  }

  hasTranslation(translation: string): translation is Translation {
    return isTranslation(translation);
  }
}
