import { readFile } from "node:fs/promises";
import path from "node:path";

import { verseKey, type BookSlug } from "./books.js";
import { TRANSLATIONS, type Translation } from "./lookup.js";

export interface PoetryLine {
  indent: 1 | 2 | 3;
  text: string;
}

export interface PoetryVerseLayout {
  lines: PoetryLine[];
  paragraphBreakBefore?: boolean;
  stanzaBreakAfter?: boolean;
}

export type PoetryLayoutIndex = Record<string, PoetryVerseLayout>;

const EM_SPACE = "\u2003";

export function formatPoetryVerseBlock(
  verse: number,
  layout: PoetryVerseLayout,
): string[] {
  return layout.lines.map((line, index) => {
    if (index === 0) {
      return `**${verse}** ${line.text}`;
    }

    return `${EM_SPACE.repeat(line.indent)}${line.text}`;
  });
}

function isMultiLineLayout(layout: PoetryVerseLayout): boolean {
  return layout.lines.length > 1;
}

export function formatUsfmCitationLines(
  verses: number[],
  getLayout: (verse: number) => PoetryVerseLayout | undefined,
  getFallbackText: (verse: number) => string | undefined,
  options?: { proseLayout?: "paragraph" | "verse" },
): string[] | undefined {
  const proseLayout = options?.proseLayout ?? "paragraph";
  const output: string[] = [];
  let paragraphParts: string[] = [];
  let previousVerse: number | undefined;

  const flushParagraph = (): void => {
    if (paragraphParts.length === 0) {
      return;
    }

    output.push(paragraphParts.join(" "));
    paragraphParts = [];
  };

  for (const verse of verses) {
    if (previousVerse !== undefined) {
      const previousLayout = getLayout(previousVerse);
      if (previousLayout?.stanzaBreakAfter) {
        flushParagraph();
        output.push("");
      }
    }

    const layout = getLayout(verse);
    const fallback = getFallbackText(verse);

    if (!layout?.lines.length && !fallback) {
      return undefined;
    }

    if (layout?.paragraphBreakBefore) {
      flushParagraph();
      if (proseLayout === "paragraph" && output.length > 0) {
        output.push("");
      }
    }

    if (layout && isMultiLineLayout(layout)) {
      flushParagraph();
      output.push(...formatPoetryVerseBlock(verse, layout));
      previousVerse = verse;
      continue;
    }

    const text = layout?.lines[0]?.text ?? fallback;
    if (!text) {
      return undefined;
    }

    const line = `**${verse}.** ${text}`;
    if (proseLayout === "verse") {
      flushParagraph();
      output.push(line);
    } else {
      paragraphParts.push(line);
    }

    previousVerse = verse;
  }

  flushParagraph();

  while (output.at(-1) === "") {
    output.pop();
  }

  return output;
}

/** @deprecated Use formatUsfmCitationLines */
export const formatPoetryCitationLines = formatUsfmCitationLines;

export class PoetryLayoutLookup {
  private constructor(
    private readonly indexes: Partial<Record<Translation, PoetryLayoutIndex>>,
  ) {}

  static async load(dataDir: string): Promise<PoetryLayoutLookup> {
    const indexes: Partial<Record<Translation, PoetryLayoutIndex>> = {};

    for (const translation of TRANSLATIONS) {
      const filePath = path.join(dataDir, `poetry-${translation}.json`);
      try {
        const raw = await readFile(filePath, "utf8");
        indexes[translation] = JSON.parse(raw) as PoetryLayoutIndex;
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          continue;
        }

        throw error;
      }
    }

    return new PoetryLayoutLookup(indexes);
  }

  static fromIndex(
    index: PoetryLayoutIndex,
    translation: Translation = "web",
  ): PoetryLayoutLookup {
    return new PoetryLayoutLookup({ [translation]: index });
  }

  hasBook(translation: Translation, book: BookSlug): boolean {
    const index = this.indexes[translation];
    if (!index) {
      return false;
    }

    const prefix = `${book}.`;
    return Object.keys(index).some((key) => key.startsWith(prefix));
  }

  getVerse(
    translation: Translation,
    book: BookSlug,
    chapter: number,
    verse: number,
  ): PoetryVerseLayout | undefined {
    return this.indexes[translation]?.[verseKey(book, chapter, verse)];
  }
}
