import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  bookNameToSlug,
  verseKey,
  type BookSlug,
} from "../src/citations/bible/books.js";
import {
  TRANSLATIONS,
  type Translation,
  type VerseIndex,
} from "../src/citations/bible/lookup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const SCROLLMAPPER_BASE =
  "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json";

const SCROLLMAPPER_SOURCES = {
  asv: "ASV.json",
  ylt: "YLT.json",
  kjv: "KJV.json",
  geneva: "Geneva1599.json",
  tyndale: "Tyndale.json",
  wyc: "Wycliffe.json",
} as const satisfies Record<
  Exclude<Translation, "web">,
  string
>;

const WEB_SOURCE =
  "https://raw.githubusercontent.com/ringletech/webu-open-bible/main/json/complete-bible.json";

interface WebVerseRow {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ScrollmapperVerse {
  verse: number;
  text: string;
}

interface ScrollmapperChapter {
  chapter: number;
  verses: ScrollmapperVerse[];
}

interface ScrollmapperBook {
  name: string;
  chapters: ScrollmapperChapter[];
}

interface ScrollmapperBible {
  books: ScrollmapperBook[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function addVerse(
  index: VerseIndex,
  bookName: string,
  chapter: number,
  verse: number,
  text: string,
): boolean {
  const slug = bookNameToSlug(bookName);
  if (!slug) {
    return false;
  }

  index[verseKey(slug, chapter, verse)] = text.trim();
  return true;
}

function buildWebIndex(rows: WebVerseRow[]): VerseIndex {
  const index: VerseIndex = {};

  for (const row of rows) {
    if (!addVerse(index, row.book, row.chapter, row.verse, row.text)) {
      throw new Error(`Unknown book name: ${row.book}`);
    }
  }

  return index;
}

function buildScrollmapperIndex(bible: ScrollmapperBible): VerseIndex {
  const index: VerseIndex = {};
  const skippedBooks = new Set<string>();

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (
          !addVerse(
            index,
            book.name,
            chapter.chapter,
            verse.verse,
            verse.text,
          )
        ) {
          skippedBooks.add(book.name);
        }
      }
    }
  }

  if (skippedBooks.size > 0) {
    console.info(
      `Skipped ${skippedBooks.size} unsupported book(s): ${[...skippedBooks].sort().join(", ")}`,
    );
  }

  return index;
}

function countVerses(index: VerseIndex): number {
  return Object.keys(index).length;
}

async function writeIndex(
  translation: Translation,
  index: VerseIndex,
): Promise<void> {
  const filePath = path.join(dataDir, `${translation}.json`);
  await writeFile(filePath, JSON.stringify(index));
  console.info(`Wrote ${translation}.json (${countVerses(index)} verses)`);
}

async function main(): Promise<void> {
  await mkdir(dataDir, { recursive: true });

  console.info("Fetching WEB...");
  const webRows = await fetchJson<WebVerseRow[]>(WEB_SOURCE);
  await writeIndex("web", buildWebIndex(webRows));

  for (const [translation, fileName] of Object.entries(SCROLLMAPPER_SOURCES)) {
    console.info(`Fetching ${translation.toUpperCase()}...`);
    const bible = await fetchJson<ScrollmapperBible>(
      `${SCROLLMAPPER_BASE}/${fileName}`,
    );
    await writeIndex(
      translation as Exclude<Translation, "web">,
      buildScrollmapperIndex(bible),
    );
  }

  const sanityBook: BookSlug = "gen";
  for (const translation of TRANSLATIONS) {
    const filePath = path.join(dataDir, `${translation}.json`);
    const index = JSON.parse(await readFile(filePath, "utf8")) as VerseIndex;
    const key = verseKey(sanityBook, 1, 1);
    if (!index[key]) {
      throw new Error(`Sanity check failed: missing ${translation} ${key}`);
    }
  }

  console.info("Done.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
