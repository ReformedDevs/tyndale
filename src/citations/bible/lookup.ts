import { readFile } from "node:fs/promises";
import path from "node:path";

import { verseKey, type BookSlug } from "./books.js";

export const TRANSLATIONS = ["web", "asv", "ylt"] as const;
export type Translation = (typeof TRANSLATIONS)[number];

export function isTranslation(value: string): value is Translation {
  return (TRANSLATIONS as readonly string[]).includes(value);
}

export type VerseIndex = Record<string, string>;

export class VerseLookup {
  private constructor(
    private readonly indexes: Record<Translation, VerseIndex>,
  ) {}

  static async load(dataDir: string): Promise<VerseLookup> {
    const indexes = {} as Record<Translation, VerseIndex>;

    for (const translation of TRANSLATIONS) {
      const filePath = path.join(dataDir, `${translation}.json`);
      const raw = await readFile(filePath, "utf8");
      indexes[translation] = JSON.parse(raw) as VerseIndex;
    }

    return new VerseLookup(indexes);
  }

  static fromIndexes(indexes: Record<Translation, VerseIndex>): VerseLookup {
    return new VerseLookup(indexes);
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
